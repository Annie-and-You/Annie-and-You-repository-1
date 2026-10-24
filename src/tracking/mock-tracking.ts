import type { HandObservation, TrackingFrame } from '../shared/contracts';

// 自建的手形示意，不是摄像头数据或模型输出。
const shape: readonly (readonly [number, number, number])[] = [
  [0, 0, 0],
  [-0.04, -0.035, -0.005],
  [-0.075, -0.085, -0.01],
  [-0.103, -0.13, -0.015],
  [-0.13, -0.155, -0.02],
  [-0.05, -0.13, 0],
  [-0.06, -0.235, -0.005],
  [-0.065, -0.305, -0.008],
  [-0.065, -0.365, -0.01],
  [0, -0.145, 0],
  [0, -0.265, -0.005],
  [0, -0.345, -0.008],
  [0, -0.41, -0.01],
  [0.046, -0.135, 0],
  [0.055, -0.245, -0.005],
  [0.06, -0.31, -0.008],
  [0.065, -0.36, -0.01],
  [0.09, -0.105, 0],
  [0.115, -0.19, -0.005],
  [0.13, -0.24, -0.008],
  [0.14, -0.29, -0.01],
];

function createHand(
  handedness: 'Left' | 'Right',
  anchorX: number,
  drift: number,
): HandObservation {
  const direction = handedness === 'Left' ? 1 : -1;
  return {
    handedness,
    handednessScore: 1,
    landmarks: shape.map(([x, y, z]) => ({
      x: anchorX + drift + x * 0.65 * direction,
      y: 0.76 + y,
      z,
    })),
  };
}

/** 离散模拟样本。时间与 inferenceMs 是占位语义，不能用于性能验收。 */
export function createMockTrackingFrame(
  frameId: number,
  sampledAtMs: number,
  handCount: 0 | 1 | 2,
): TrackingFrame {
  const drift = Math.sin(frameId * 0.45) * 0.025;
  const hands: HandObservation[] = [];
  if (handCount >= 1) hands.push(createHand('Left', 0.28, drift));
  if (handCount === 2) hands.push(createHand('Right', 0.72, -drift));

  return {
    frameId,
    sampledAtMs,
    receivedAtMs: sampledAtMs,
    sourceSize: { width: 1280, height: 720 },
    hands,
    inferenceMs: 0,
  };
}
