import type { CancelReason, HandObservation, InteractionPointerEvent, PanelPoint, Size, SurfaceMapping, TrackingFrame, VideoPoint } from '../shared/contracts';
import { GESTURE_PARAMETERS, Pinch, pinchRatio } from './pinch';
import { sourceToVideo } from './rect-mapping';

export interface PointerSnapshot {
  point: PanelPoint | null;
  pointerId: string | null;
  state: 'no-hand' | 'ambiguous' | 'waiting-open' | 'hover' | 'pressed';
  ratio: number | null;
}

const empty: PointerSnapshot = { point: null, pointerId: null, state: 'no-hand', ratio: null };
const valid = (hand: HandObservation) => hand.landmarks.length === 21 && hand.landmarks.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
function palm(hand: HandObservation): VideoPoint {
  const points = [0, 5, 9, 13, 17].map((i) => hand.landmarks[i]!);
  return { x: points.reduce((n, p) => n + p.x, 0) / 5, y: points.reduce((n, p) => n + p.y, 0) / 5 };
}

/** S2 owns a single conservative association; ambiguous hands cancel, never exchange. */
export class SingleHandPointer {
  private pinch = new Pinch();
  private state: PointerSnapshot = empty;
  private owner: { anchor: VideoPoint; hand: HandObservation; id: string } | null = null;
  private smooth: VideoPoint | null = null;
  private sequence = 0;
  private lastTime: number | null = null;
  private sourceSize: Size | null = null;
  private candidateCount = 0;
  get snapshot(): Readonly<PointerSnapshot> { return this.state; }

  cancel(reason: CancelReason, tMs: number): InteractionPointerEvent[] {
    const events: InteractionPointerEvent[] = this.owner ? [{ pointerId: this.owner.id, source: 'hand', phase: 'cancel', reason, tMs }] : [];
    this.owner = null; this.smooth = null; this.pinch.reset(); this.state = empty; this.candidateCount = 0;
    return events;
  }

  process(frame: TrackingFrame, mapping: SurfaceMapping): InteractionPointerEvent[] {
    const t = frame.sampledAtMs;
    if (!Number.isFinite(t) || (this.lastTime !== null && t <= this.lastTime)) return [];
    const previous = this.lastTime;
    this.lastTime = t;
    if (!Number.isFinite(frame.receivedAtMs) || frame.receivedAtMs < t || frame.receivedAtMs - t > GESTURE_PARAMETERS.lostMs || (previous !== null && t - previous > GESTURE_PARAMETERS.lostMs)) return this.cancel('tracking-lost', t);
    const size = frame.sourceSize;
    if (!Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return this.cancel('tracking-lost', t);
    if (this.sourceSize && (this.sourceSize.width !== size.width || this.sourceSize.height !== size.height)) {
      this.sourceSize = size;
      return this.cancel('mapping-changed', t);
    }
    this.sourceSize = size;
    const candidates = frame.hands.filter(valid).filter((hand) => pinchRatio(hand.landmarks, size) !== null);
    const previousCount = this.candidateCount;
    this.candidateCount = candidates.length;
    let hand: HandObservation | undefined;
    if (!this.owner) {
      if (candidates.length !== 1) {
        this.state = { ...empty, state: candidates.length > 1 ? 'ambiguous' : 'no-hand' };
        return [];
      }
      hand = candidates[0]!;
      this.owner = { anchor: palm(hand), hand, id: `hand-${++this.sequence}` };
    } else {
      const owner = this.owner;
      const ranked = candidates.filter((candidate) => !(candidate.handednessScore >= .65 && owner.hand.handednessScore >= .65 && candidate.handedness !== 'Unknown' && owner.hand.handedness !== 'Unknown' && candidate.handedness !== owner.hand.handedness))
        .map((candidate) => {
          const anchor = palm(candidate);
          return { hand: candidate, distance: Math.hypot((anchor.x - owner.anchor.x) * size.width, (anchor.y - owner.anchor.y) * size.height) / Math.hypot(size.width, size.height) };
        }).filter((candidate) => candidate.distance <= .18).sort((a, b) => a.distance - b.distance);
      if (!ranked.length) return this.cancel('tracking-lost', t);
      // A remaining hand may be the known bystander, even with the same label.
      // S2 cancels any ambiguous reduction instead of transferring capture.
      if (previousCount > candidates.length) {
        const events = this.cancel('ambiguous-hand', t);
        this.state = { ...empty, state: 'ambiguous' };
        return events;
      }
      if (ranked[1] && ranked[1].distance - ranked[0]!.distance < .06) {
        const events = this.cancel('ambiguous-hand', t);
        this.state = { ...empty, state: 'ambiguous' };
        return events;
      }
      hand = ranked[0]!.hand;
      this.owner = { ...owner, anchor: palm(hand), hand };
    }
    const raw = sourceToVideo(palm(hand))!;
    const alpha = previous === null ? 1 : 1 - Math.exp(-(t - previous) / GESTURE_PARAMETERS.smoothingMs);
    this.smooth = this.smooth ? { x: this.smooth.x + alpha * (raw.x - this.smooth.x), y: this.smooth.y + alpha * (raw.y - this.smooth.y) } : raw;
    const point = mapping.toPanel(this.smooth);
    if (!point) return this.cancel('mapping-changed', t);
    const ratio = pinchRatio(hand.landmarks, size)!;
    const gesture = this.pinch.update(ratio, t);
    this.state = { point, pointerId: this.owner!.id, ratio, state: !gesture.armed ? 'waiting-open' : gesture.pressed ? 'pressed' : 'hover' };
    return [{ pointerId: this.owner!.id, source: 'hand', phase: gesture.phase, point, tMs: t }];
  }
}
