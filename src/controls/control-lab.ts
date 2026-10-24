import type { CancelReason, ControlId, ControlLayout, InteractionPointerEvent, PanelPoint } from '../shared/contracts';

export const LAB_LAYOUT: ControlLayout = [
  { id: 'test-a', kind: 'button', bounds: { u: .07, v: .18, width: .5, height: .25 }, enabled: true },
  { id: 'test-b', kind: 'button', bounds: { u: .07, v: .58, width: .5, height: .25 }, enabled: true },
  { id: 'level', kind: 'fader', bounds: { u: .7, v: .14, width: .2, height: .72 }, enabled: true },
];

export interface LabSnapshot {
  a: number;
  b: number;
  level: number;
  captured: ControlId | null;
  lastCancel: CancelReason | null;
}

const clamp = (n: number) => Math.min(1, Math.max(0, n));
const finite = (point: PanelPoint) => Number.isFinite(point.u) && Number.isFinite(point.v);

export class ControlLab {
  private state: LabSnapshot = { a: 0, b: 0, level: .5, captured: null, lastCancel: null };
  private capture: { pointerId: string; controlId: ControlId; startV: number; startValue: number } | null = null;
  get snapshot(): Readonly<LabSnapshot> { return this.state; }

  dispatch(event: InteractionPointerEvent): void {
    if (event.phase === 'cancel') {
      if (this.capture?.pointerId === event.pointerId) { this.capture = null; this.state = { ...this.state, captured: null, lastCancel: event.reason }; }
      return;
    }
    if (!finite(event.point)) return;
    const hit = LAB_LAYOUT.find(({ bounds: b, enabled }) => enabled && event.point.u >= b.u && event.point.u <= b.u + b.width && event.point.v >= b.v && event.point.v <= b.v + b.height);
    if (event.phase === 'down' && !this.capture && hit) {
      this.capture = { pointerId: event.pointerId, controlId: hit.id, startV: event.point.v, startValue: this.state.level };
      this.state = { ...this.state, captured: hit.id, lastCancel: null };
      return;
    }
    if (!this.capture || this.capture.pointerId !== event.pointerId) return;
    if (this.capture.controlId === 'level' && (event.phase === 'move' || event.phase === 'up')) {
      const travel = LAB_LAYOUT.find((control) => control.id === 'level')!.bounds.height;
      this.state = { ...this.state, level: clamp(this.capture.startValue + (this.capture.startV - event.point.v) / travel) };
    }
    if (event.phase === 'up') {
      if (hit?.id === this.capture.controlId) {
        if (hit.id === 'test-a') this.state = { ...this.state, a: this.state.a + 1 };
        if (hit.id === 'test-b') this.state = { ...this.state, b: this.state.b + 1 };
      }
      this.capture = null;
      this.state = { ...this.state, captured: null };
    }
  }
}
