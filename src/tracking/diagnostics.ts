import type { HandObservation, TrackingFrame } from '../shared/contracts';

export function hasValidPointer(hand: HandObservation): boolean {
  return hand.landmarks.length === 21 && hand.landmarks.every((p) =>
    Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) &&
    p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1,
  );
}

export interface DiagnosticSnapshot {
  processed: number;
  valid: number;
  validPercent: number | null;
  validHz: number;
  latencyP50: number | null;
  latencyP95: number | null;
  inferenceP95: number | null;
}

function percentile(histogram: Uint32Array, count: number, fraction: number): number | null {
  if (!count) return null;
  const rank = Math.ceil(count * fraction);
  let total = 0;
  for (let i = 0; i < histogram.length; i++) {
    total += histogram[i]!;
    if (total >= rank) return i;
  }
  return null;
}

/** Bounded 1 ms histograms; no video or landmark history is retained. */
export class TrackingDiagnostics {
  private processed = 0;
  private valid = 0;
  private latency = new Uint32Array(10001);
  private inference = new Uint32Array(10001);

  constructor(private expectedHands: 1 | 2, private startedAtMs: number) {}

  record(frame: TrackingFrame): void {
    const elapsed = frame.receivedAtMs - frame.sampledAtMs;
    if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(frame.inferenceMs) || frame.inferenceMs < 0) return;
    this.processed++;
    if (frame.hands.filter(hasValidPointer).length >= this.expectedHands) this.valid++;
    this.latency[Math.min(10000, Math.round(elapsed))]!++;
    this.inference[Math.min(10000, Math.round(frame.inferenceMs))]!++;
  }

  snapshot(nowMs: number): DiagnosticSnapshot {
    const seconds = Math.max(0, nowMs - this.startedAtMs) / 1000;
    return {
      processed: this.processed,
      valid: this.valid,
      validPercent: this.processed ? this.valid / this.processed * 100 : null,
      validHz: seconds > 0 ? this.valid / seconds : 0,
      latencyP50: percentile(this.latency, this.processed, 0.5),
      latencyP95: percentile(this.latency, this.processed, 0.95),
      inferenceP95: percentile(this.inference, this.processed, 0.95),
    };
  }
}
