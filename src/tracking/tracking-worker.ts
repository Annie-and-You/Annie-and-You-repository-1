import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandObservation } from '../shared/contracts';
import type { Delegate, TrackingConfig, WorkerReply, WorkerRequest } from './worker-protocol';

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerReply): void;
};
let detector: HandLandmarker | null = null;
let config: TrackingConfig;
let delegate: Delegate;
let baseUrl: string;

async function initialize(next: Delegate): Promise<void> {
  detector?.close();
  detector = null;
  delegate = next;
  const fileset = await FilesetResolver.forVisionTasks(new URL('tracking/wasm', baseUrl).href, true);
  detector = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: new URL('tracking/hand_landmarker.task', baseUrl).href, delegate },
    runningMode: 'VIDEO', numHands: config.numHands,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5,
  });
}

async function handle(request: WorkerRequest): Promise<void> {
  if (request.type === 'init') {
    config = request.config;
    baseUrl = request.baseUrl;
    try { await initialize(config.delegate); }
    catch (error) { if (config.delegate !== 'GPU') throw error; await initialize('CPU'); }
    scope.postMessage({ type: 'ready', delegate, fallback: delegate !== config.delegate });
    return;
  }
  const { bitmap, ticket, timestampMs } = request;
  try {
    if (!detector) throw new Error('Detector is not ready');
    const started = performance.now();
    let result;
    try { result = detector.detectForVideo(bitmap, timestampMs); }
    catch (error) {
      if (delegate !== 'GPU') throw error;
      await initialize('CPU');
      // Discard this request so GPU failure/reinitialization do not enter CPU metrics.
      scope.postMessage({ type: 'fallback', delegate: 'CPU', ticket });
      return;
    }
    const inferenceMs = performance.now() - started;
    const hands: HandObservation[] = result.landmarks.map((landmarks, index) => {
      const category = result.handedness[index]?.[0];
      const name = category?.categoryName;
      return {
        landmarks: landmarks.map(({ x, y, z }) => ({ x, y, z })),
        handedness: name === 'Left' || name === 'Right' ? name : 'Unknown',
        handednessScore: category?.score ?? 0,
      };
    });
    scope.postMessage({ type: 'result', ticket, hands, inferenceMs });
  } finally { bitmap.close(); }
}

scope.onmessage = ({ data }) => {
  void handle(data).catch(() => scope.postMessage({ type: 'error', message: '手部识别失败。请确认本地模型与 WASM 已准备好，或切换 CPU 后重试。' }));
};
