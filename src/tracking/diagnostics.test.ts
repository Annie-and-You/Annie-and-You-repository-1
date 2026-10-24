import { describe, expect, it } from 'vitest';
import type { TrackingFrame } from '../shared/contracts';
import { createMockTrackingFrame } from './mock-tracking';
import { TrackingDiagnostics } from './diagnostics';

function sample(id: number, hands: 0 | 1 | 2, latency: number): TrackingFrame {
  return { ...createMockTrackingFrame(id, id * 100, hands), receivedAtMs: id * 100 + latency, inferenceMs: 10 };
}

describe('tracking diagnostics', () => {
  it('reports literal latency percentiles and valid results over elapsed time', () => {
    const metrics = new TrackingDiagnostics(2, 0);
    metrics.record(sample(1, 2, 20));
    metrics.record(sample(2, 1, 50));
    metrics.record(sample(3, 0, 100));
    metrics.record(sample(4, 2, 40));
    expect(metrics.snapshot(1000)).toMatchObject({
      processed: 4, valid: 2, validPercent: 50, validHz: 2,
      latencyP50: 40, latencyP95: 100, inferenceP95: 10,
    });
  });

  it('rejects incomplete, nonfinite and out-of-frame hands as valid pointers', () => {
    const metrics = new TrackingDiagnostics(1, 0);
    const frame = sample(1, 1, 20);
    const hand = frame.hands[0]!;
    for (const landmarks of [hand.landmarks.slice(1), hand.landmarks.map((p, i) => i === 8 ? { ...p, x: 1.2 } : p), hand.landmarks.map((p, i) => i === 0 ? { ...p, z: NaN } : p)]) {
      metrics.record({ ...frame, hands: [{ ...hand, landmarks }] });
    }
    expect(metrics.snapshot(1000)).toMatchObject({ processed: 3, valid: 0, validHz: 0 });
  });

  it('does not claim measurements without returned frames', () => {
    expect(new TrackingDiagnostics(1, 0).snapshot(1000)).toMatchObject({ validPercent: null, latencyP95: null, validHz: 0 });
  });
});
