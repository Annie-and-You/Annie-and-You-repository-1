import { describe, expect, it } from 'vitest';
import type { InteractionPointerEvent } from '../shared/contracts';
import { ControlLab } from './control-lab';

const event = (phase: 'down' | 'move' | 'up', u: number, v: number, pointerId = 'hand-1'): InteractionPointerEvent => ({ phase, point: { u, v }, source: 'hand', pointerId, tMs: 1 });
const cancel: InteractionPointerEvent = { phase: 'cancel', reason: 'tracking-lost', source: 'hand', pointerId: 'hand-1', tMs: 1 };

describe('button and fader capture', () => {
  it('fires a button once on release inside its original target', () => {
    const lab = new ControlLab();
    lab.dispatch(event('down', .3, .3));
    lab.dispatch(event('move', .3, .3)); lab.dispatch(event('move', .3, .3));
    expect(lab.snapshot.a).toBe(0);
    lab.dispatch(event('up', .3, .3)); lab.dispatch(event('up', .3, .3));
    expect(lab.snapshot.a).toBe(1);
    expect(lab.snapshot.captured).toBeNull();
  });
  it('does not fire when released outside, over another button, or cancelled', () => {
    const lab = new ControlLab();
    lab.dispatch(event('down', .3, .3)); lab.dispatch(event('up', .3, .7));
    lab.dispatch(event('down', .3, .3)); lab.dispatch(cancel); lab.dispatch(event('up', .3, .3));
    lab.dispatch(event('down', 1.1, .3)); lab.dispatch(event('up', .3, .3));
    expect(lab.snapshot).toMatchObject({ a: 0, b: 0, captured: null, lastCancel: 'tracking-lost' });
  });
  it('keeps the initial fader value and drag offset, including beyond the panel', () => {
    const lab = new ControlLab();
    lab.dispatch(event('down', .8, .7));
    expect(lab.snapshot.level).toBe(.5);
    lab.dispatch(event('move', 1.3, .52));
    expect(lab.snapshot.level).toBeCloseTo(.75);
    lab.dispatch(event('move', 1.3, -1));
    expect(lab.snapshot.level).toBe(1);
    lab.dispatch(event('move', -.2, 2));
    expect(lab.snapshot.level).toBe(0);
    lab.dispatch(event('up', -.2, 2));
    expect(lab.snapshot).toMatchObject({ level: 0, captured: null });
  });
  it('ignores another pointer while captured and freezes on cancellation', () => {
    const lab = new ControlLab();
    lab.dispatch(event('down', .8, .5));
    lab.dispatch(event('down', .3, .3, 'hand-2')); lab.dispatch(event('up', .3, .3, 'hand-2'));
    lab.dispatch(event('move', .8, .14, 'hand-2'));
    expect(lab.snapshot).toMatchObject({ level: .5, a: 0, captured: 'level' });
    lab.dispatch(cancel); lab.dispatch(event('move', .8, .14));
    expect(lab.snapshot).toMatchObject({ level: .5, captured: null });
  });
  it('rejects nonfinite positions without corrupting the current value', () => {
    const lab = new ControlLab();
    lab.dispatch(event('down', .8, .5)); lab.dispatch(event('move', .8, NaN));
    expect(lab.snapshot.level).toBe(.5);
  });
});
