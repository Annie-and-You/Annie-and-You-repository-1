import type { TrackingFrame, Size } from '../shared/contracts';
import { TrackingDiagnostics, type DiagnosticSnapshot } from './diagnostics';
import { FrameGate } from './frame-gate';
import type { Delegate, TrackingConfig, WorkerReply, WorkerRequest } from './worker-protocol';

export interface TrackingStatus {
  status: 'loading' | 'running' | 'stopped' | 'error';
  delegate: Delegate;
  numHands: 1 | 2;
  fallback: boolean;
  hands: number;
  metrics: DiagnosticSnapshot | null;
  error: string | null;
}

interface WorkerPort {
  onmessage: ((event: MessageEvent<WorkerReply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: WorkerRequest, transfer?: Transferable[]): void;
  terminate(): void;
}

interface Dependencies {
  createWorker(): WorkerPort;
  capture(video: HTMLVideoElement): Promise<ImageBitmap>;
  now(): number;
  schedule(video: HTMLVideoElement, callback: () => void): () => void;
}

const defaults: Dependencies = {
  createWorker: () => new Worker(new URL('./tracking-worker.ts', import.meta.url), { type: 'module' }),
  capture: (video) => createImageBitmap(video),
  now: () => performance.now(),
  schedule(video, callback) {
    if ('requestVideoFrameCallback' in video) {
      const id = video.requestVideoFrameCallback(callback);
      return () => video.cancelVideoFrameCallback(id);
    }
    const id = requestAnimationFrame(callback);
    return () => cancelAnimationFrame(id);
  },
};

/** Main-thread coordinator; neither owns a camera stream nor changes audio. */
export class TrackingSession {
  private active = false;
  private worker: WorkerPort | null = null;
  private gate = new FrameGate();
  private pending: { ticket: number; sampledAtMs: number; sourceSize: Size } | null = null;
  private cancelFrame: (() => void) | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private staleOverlay: ReturnType<typeof setTimeout> | null = null;
  private diagnostics: TrackingDiagnostics | null = null;
  private status: TrackingStatus;

  constructor(
    private video: HTMLVideoElement,
    private config: TrackingConfig,
    private listeners: { frame(frame: TrackingFrame | null): void; state(status: TrackingStatus): void },
    private deps: Dependencies = defaults,
  ) {
    this.status = { status: 'stopped', delegate: config.delegate, numHands: config.numHands, fallback: false, hands: 0, metrics: null, error: null };
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.publish({ ...this.status, status: 'loading', metrics: null, error: null });
    try {
      const worker = this.deps.createWorker();
      this.worker = worker;
      worker.onmessage = ({ data }) => { if (this.active && this.worker === worker) this.receive(data); };
      worker.onerror = () => this.fail('识别进程启动失败。请刷新页面后重新启用摄像头。');
      const baseUrl = new URL(import.meta.env.BASE_URL, globalThis.location?.href ?? 'http://localhost/').href;
      this.armTimeout(30000, '模型加载超时。请确认已完成资源准备，再重新启用。');
      worker.postMessage({ type: 'init', config: this.config, baseUrl });
    } catch {
      this.fail('无法创建识别进程。请使用桌面版 Edge 打开 localhost 地址。');
    }
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.cancelFrame?.();
    this.cancelFrame = null;
    this.clearTimeout();
    if (this.heartbeat !== null) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.staleOverlay !== null) clearTimeout(this.staleOverlay);
    this.staleOverlay = null;
    this.gate.reset();
    this.pending = null;
    this.worker?.terminate();
    this.worker = null;
    this.listeners.frame(null);
    this.publish({ ...this.status, status: 'stopped', hands: 0, metrics: this.diagnostics?.snapshot(this.deps.now()) ?? null });
  }

  private receive(reply: WorkerReply): void {
    if (reply.type === 'error') { this.fail(reply.message); return; }
    if (reply.type === 'fallback') {
      if (!this.pending || !this.gate.finish(reply.ticket)) return;
      this.clearTimeout();
      this.pending = null;
      this.listeners.frame(null);
      this.armTimeout(10000, '摄像头没有产生新画面。请检查设备后重新启用。');
      // A new delegate starts a separate measurement run.
      this.diagnostics = new TrackingDiagnostics(this.config.numHands, this.deps.now());
      this.publish({ ...this.status, delegate: 'CPU', fallback: true, hands: 0, metrics: null });
      return;
    }
    if (reply.type === 'ready') {
      this.clearTimeout();
      this.armTimeout(10000, '摄像头没有产生新画面。请检查设备后重新启用。');
      this.diagnostics = new TrackingDiagnostics(this.config.numHands, this.deps.now());
      this.publish({ ...this.status, status: 'running', delegate: reply.delegate, fallback: reply.fallback });
      this.heartbeat = setInterval(() => this.publish({ ...this.status, metrics: this.diagnostics?.snapshot(this.deps.now()) ?? null }), 500);
      this.queue();
      return;
    }
    if (reply.type === 'result') {
      if (!this.pending || !this.gate.finish(reply.ticket)) return;
      this.clearTimeout();
      const frame: TrackingFrame = {
        frameId: reply.ticket, sampledAtMs: this.pending.sampledAtMs,
        receivedAtMs: this.deps.now(), sourceSize: this.pending.sourceSize,
        hands: reply.hands, inferenceMs: reply.inferenceMs,
      };
      this.pending = null;
      this.armTimeout(10000, '摄像头没有产生新画面。请检查设备后重新启用。');
      this.diagnostics?.record(frame);
      this.status = { ...this.status, hands: frame.hands.length };
      this.listeners.frame(frame);
      if (this.staleOverlay !== null) clearTimeout(this.staleOverlay);
      this.staleOverlay = setTimeout(() => {
        this.status = { ...this.status, hands: 0 };
        this.listeners.frame(null);
      }, 150);
    }
  }

  private queue(): void {
    this.cancelFrame = this.deps.schedule(this.video, () => {
      if (!this.active) return;
      this.queue();
      void this.sample();
    });
  }

  private async sample(): Promise<void> {
    if (this.video.videoWidth <= 0 || this.video.videoHeight <= 0) return;
    const ticket = this.gate.begin();
    if (ticket === null) return;
    const worker = this.worker;
    this.pending = { ticket, sampledAtMs: this.deps.now(), sourceSize: { width: this.video.videoWidth, height: this.video.videoHeight } };
    this.armTimeout(10000, '识别长时间没有返回。已停止摄像头，请重新启用或改用 CPU。');
    let bitmap: ImageBitmap | null = null;
    try {
      bitmap = await this.deps.capture(this.video);
      if (!this.active || this.worker !== worker || this.pending?.ticket !== ticket) { bitmap.close(); return; }
      worker!.postMessage({ type: 'frame', ticket, bitmap, timestampMs: this.pending.sampledAtMs }, [bitmap]);
    } catch {
      bitmap?.close();
      if (this.active && this.worker === worker) this.fail('无法读取摄像头帧。请关闭占用摄像头的软件，再重新启用。');
    }
  }

  private publish(status: TrackingStatus): void { this.status = status; this.listeners.state(status); }
  private fail(message: string): void { this.stop(); this.publish({ ...this.status, status: 'error', error: message }); }
  private clearTimeout(): void { if (this.timeout !== null) clearTimeout(this.timeout); this.timeout = null; }
  private armTimeout(ms: number, message: string): void { this.clearTimeout(); this.timeout = setTimeout(() => this.fail(message), ms); }
}
