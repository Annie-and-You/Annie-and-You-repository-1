import type { Landmark, Size } from '../shared/contracts';

export const GESTURE_PARAMETERS = { closeRatio: .32, openRatio: .52, closeMs: 60, openMs: 40, smoothingMs: 45, lostMs: 150 } as const;

export function pinchRatio(points: readonly Landmark[], size: Size): number | null {
  if (points.length !== 21 || !Number.isFinite(size.width) || !Number.isFinite(size.height) || size.width <= 0 || size.height <= 0) return null;
  const distance = (a: Landmark, b: Landmark) => Math.hypot((a.x - b.x) * size.width, (a.y - b.y) * size.height);
  const palm = distance(points[5]!, points[17]!);
  const ratio = distance(points[4]!, points[8]!) / palm;
  return palm >= Math.min(size.width, size.height) * .02 && Number.isFinite(ratio) ? ratio : null;
}

/** A held pinch is not an activation until this lifecycle has seen an open hand. */
export class Pinch {
  private armed = false;
  private pressed = false;
  private candidate: { closed: boolean; since: number } | null = null;

  reset(): void { this.armed = false; this.pressed = false; this.candidate = null; }

  update(ratio: number, tMs: number): { phase: 'hover' | 'down' | 'move' | 'up'; armed: boolean; pressed: boolean } {
    let phase: 'hover' | 'down' | 'move' | 'up' = this.pressed ? 'move' : 'hover';
    const closed = ratio <= GESTURE_PARAMETERS.closeRatio;
    const open = ratio >= GESTURE_PARAMETERS.openRatio;
    const transition = this.pressed || !this.armed ? open ? false : null : closed ? true : null;
    if (transition === null) this.candidate = null;
    else {
      if (this.candidate?.closed !== transition) this.candidate = { closed: transition, since: tMs };
      if (tMs - this.candidate.since >= (transition ? GESTURE_PARAMETERS.closeMs : GESTURE_PARAMETERS.openMs)) {
        if (!this.armed) this.armed = true;
        else { this.pressed = transition; phase = transition ? 'down' : 'up'; }
        this.candidate = null;
      }
    }
    return { phase, armed: this.armed, pressed: this.pressed };
  }
}
