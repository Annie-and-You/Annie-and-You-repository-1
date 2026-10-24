import { describe, expect, it } from 'vitest';
import type { HandObservation, Landmark, TrackingFrame } from '../shared/contracts';
import { createRectMapping } from './rect-mapping';
import { SingleHandPointer } from './single-hand-pointer';
import { ControlLab } from '../controls/control-lab';

const mapping = createRectMapping({ x: 0, y: 0, width: 1, height: 1 })!;
function hand(x = .5, ratio = .8, handedness: HandObservation['handedness'] = 'Left', y = .5): HandObservation {
  const landmarks: Landmark[] = Array.from({ length: 21 }, () => ({ x, y, z: 0 }));
  landmarks[0] = { x, y: y + .2, z: 0 }; landmarks[5] = { x: x - .06, y: y + .1, z: 0 };
  landmarks[17] = { x: x + .06, y: y + .1, z: 0 }; landmarks[9] = { x, y: y + .08, z: 0 };
  landmarks[13] = { x: x + .03, y: y + .1, z: 0 }; landmarks[4] = { x: x + .12 * ratio, y, z: 0 };
  return { landmarks, handedness, handednessScore: .95 };
}
const frame = (t: number, hands: readonly HandObservation[], extra: Partial<TrackingFrame> = {}): TrackingFrame => ({ frameId: t, sampledAtMs: t, receivedAtMs: t + 5, inferenceMs: 5, sourceSize: { width: 1000, height: 1000 }, hands, ...extra });
function grab(pointer: SingleHandPointer) {
  pointer.process(frame(0, [hand()]), mapping); pointer.process(frame(40, [hand()]), mapping);
  pointer.process(frame(60, [hand(.5, .1)]), mapping);
  return pointer.process(frame(120, [hand(.5, .1)]), mapping);
}

describe('single hand lifecycle', () => {
  it('emits a single down after opening and a single up after release', () => {
    const pointer = new SingleHandPointer();
    expect(grab(pointer).map((event) => event.phase)).toEqual(['down']);
    expect(pointer.process(frame(160, [hand(.5, .1)]), mapping)[0]!.phase).toBe('move');
    pointer.process(frame(180, [hand()]), mapping);
    expect(pointer.process(frame(220, [hand()]), mapping)[0]!.phase).toBe('up');
    expect(pointer.process(frame(240, [hand()]), mapping)[0]!.phase).toBe('hover');
  });
  it('does not activate an initially closed or lost/reacquired closed hand', () => {
    const pointer = new SingleHandPointer();
    pointer.process(frame(0, [hand(.5, .1)]), mapping);
    expect(pointer.process(frame(80, [hand(.5, .1)]), mapping)[0]!.phase).toBe('hover');
    expect(pointer.snapshot.state).toBe('waiting-open');
    const active = new SingleHandPointer(); grab(active);
    expect(active.process(frame(140, []), mapping)[0]).toMatchObject({ phase: 'cancel', reason: 'tracking-lost' });
    active.process(frame(160, [hand(.5, .1)]), mapping);
    expect(active.process(frame(240, [hand(.5, .1)]), mapping)[0]!.phase).toBe('hover');
  });
  it('keeps the owner when another hand appears and output order changes', () => {
    const pointer = new SingleHandPointer(); grab(pointer);
    const owner = pointer.snapshot.pointerId;
    const other = hand(.85, .1, 'Right');
    expect(pointer.process(frame(160, [other, hand(.51, .1)]), mapping)[0]).toMatchObject({ pointerId: owner, phase: 'move' });
    expect(pointer.process(frame(200, [hand(.52, .1), other]), mapping)[0]).toMatchObject({ pointerId: owner, phase: 'move' });
    expect(pointer.process(frame(240, [other]), mapping)[0]).toMatchObject({ phase: 'cancel', reason: 'tracking-lost' });
  });
  it('refuses ambiguous acquisition and cancels when candidates converge', () => {
    const pointer = new SingleHandPointer();
    expect(pointer.process(frame(0, [hand(.3), hand(.7)]), mapping)).toEqual([]);
    expect(pointer.snapshot.state).toBe('ambiguous');
    const active = new SingleHandPointer(); grab(active);
    expect(active.process(frame(160, [hand(.48, .1), hand(.52, .1)]), mapping)[0]).toMatchObject({ phase: 'cancel', reason: 'ambiguous-hand' });
  });
  it.each([
    ['low-confidence opposite label', 'Right', .5],
    ['unknown label', 'Unknown', .5],
    ['same label', 'Left', .95],
  ] as const)('does not transfer a captured button to a known second hand: %s', (_name, label, score) => {
    const pointer = new SingleHandPointer();
    const controls = new ControlLab();
    const owner = (ratio: number) => hand(.7, ratio, 'Left', .3);
    const other = { ...hand(.55, .8, label, .3), handednessScore: score };
    const send = (t: number, hands: HandObservation[]) => {
      const events = pointer.process(frame(t, hands), mapping);
      events.forEach((event) => controls.dispatch(event));
      return events;
    };
    send(0, [owner(.8)]); send(40, [owner(.8)]); send(60, [owner(.1)]); send(120, [owner(.1)]);
    expect(controls.snapshot.captured).toBe('test-a');
    send(140, [owner(.1), other]);
    expect(send(180, [other])[0]).toMatchObject({ phase: 'cancel', reason: 'ambiguous-hand' });
    send(220, [other]); send(260, [other]);
    expect(controls.snapshot).toMatchObject({ a: 0, captured: null });
  });
  it('cancels stale results, invalid points and source dimension changes', () => {
    for (const next of [
      frame(140, [hand()], { receivedAtMs: 400 }),
      frame(140, [hand()], { sourceSize: { width: 1280, height: 720 } }),
      frame(140, [{ ...hand(), landmarks: [{ x: NaN, y: .5, z: 0 }] }]),
    ]) {
      const pointer = new SingleHandPointer(); grab(pointer);
      expect(pointer.process(next, mapping)[0]!.phase).toBe('cancel');
      expect(pointer.snapshot.point).toBeNull();
    }
  });
  it('ignores duplicate/old frames and cancels after a gap beyond the loss deadline', () => {
    const pointer = new SingleHandPointer(); grab(pointer);
    expect(pointer.process(frame(100, [hand(.7, .1)]), mapping)).toEqual([]);
    expect(pointer.process(frame(120, [hand(.7, .1)]), mapping)).toEqual([]);
    expect(pointer.process(frame(300, [hand(.5, .1)]), mapping)[0]).toMatchObject({ phase: 'cancel', reason: 'tracking-lost' });
  });
  it('smooths positions by elapsed time and mirrors the selected fingertip once', () => {
    const pointer = new SingleHandPointer();
    pointer.process(frame(0, [hand(.5)]), mapping);
    pointer.process(frame(45, [hand(.6)]), mapping);
    expect(pointer.snapshot.point!.u).toBeCloseTo(.5 - .1 * (1 - Math.exp(-1)));
  });
  it('external cancellation releases capture and requires reopening', () => {
    const pointer = new SingleHandPointer(); grab(pointer);
    expect(pointer.cancel('mapping-changed', 130)[0]).toMatchObject({ phase: 'cancel', reason: 'mapping-changed' });
    pointer.process(frame(140, [hand(.5, .1)]), mapping);
    expect(pointer.snapshot.state).toBe('waiting-open');
  });
  it('integrates real tracking landmarks through mirrored mapping into exactly one button action', () => {
    const pointer = new SingleHandPointer();
    const controls = new ControlLab();
    const send = (t: number, ratio: number) => pointer.process(frame(t, [hand(.7, ratio, 'Left', .3)]), mapping).forEach((event) => controls.dispatch(event));
    send(0, .1); send(80, .1);
    expect(controls.snapshot.a).toBe(0);
    send(100, .8); send(140, .8); send(160, .1); send(220, .1); send(260, .1);
    expect(controls.snapshot).toMatchObject({ a: 0, captured: 'test-a' });
    send(280, .8); send(320, .8); send(360, .8);
    expect(controls.snapshot).toMatchObject({ a: 1, b: 0, captured: null });
  });
  it('freezes a captured fader on missing tracking and does not jump on closed reentry', () => {
    const pointer = new SingleHandPointer();
    const controls = new ControlLab();
    const send = (t: number, hands: HandObservation[]) => pointer.process(frame(t, hands), mapping).forEach((event) => controls.dispatch(event));
    send(0, [hand(.2)]); send(40, [hand(.2)]); send(60, [hand(.2, .1)]); send(120, [hand(.2, .1)]);
    expect(controls.snapshot.level).toBe(.5);
    for (let t = 160; t <= 440; t += 40) send(t, [hand(.2, .1, 'Left', .32)]);
    expect(controls.snapshot.level).toBeCloseTo(.75, 2);
    send(460, []);
    const frozen = controls.snapshot.level;
    send(480, [hand(.2, .1, 'Left', .5)]); send(560, [hand(.2, .1, 'Left', .5)]);
    expect(controls.snapshot).toMatchObject({ level: frozen, captured: null, lastCancel: 'tracking-lost' });
  });
});
