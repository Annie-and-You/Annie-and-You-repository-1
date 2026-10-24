import { describe, expect, it } from 'vitest';
import { Pinch, pinchRatio } from './pinch';
import type { Landmark } from '../shared/contracts';

describe('pinch hysteresis and time debounce', () => {
  it('requires stable open before an initial closed hand can activate', () => {
    const pinch = new Pinch();
    expect(pinch.update(.1, 0).armed).toBe(false);
    expect(pinch.update(.1, 100).phase).toBe('hover');
    pinch.update(.6, 120);
    expect(pinch.update(.6, 160).armed).toBe(true);
    pinch.update(.1, 180);
    expect(pinch.update(.1, 240).phase).toBe('down');
    expect(pinch.update(.1, 280).phase).toBe('move');
    pinch.update(.6, 300);
    expect(pinch.update(.6, 340).phase).toBe('up');
    expect(pinch.update(.6, 400).phase).toBe('hover');
  });
  it('ignores brief closure and maintains a hold in the hysteresis band', () => {
    const pinch = new Pinch();
    pinch.update(.6, 0); pinch.update(.6, 40);
    pinch.update(.2, 50); pinch.update(.4, 80);
    expect(pinch.update(.2, 100).phase).toBe('hover');
    expect(pinch.update(.2, 160).phase).toBe('down');
    expect(pinch.update(.4, 220).phase).toBe('move');
    pinch.update(.6, 240); pinch.update(.4, 260);
    expect(pinch.update(.6, 280).phase).toBe('move');
    expect(pinch.update(.6, 320).phase).toBe('up');
  });
  it('reset requires a fresh open observation', () => {
    const pinch = new Pinch();
    pinch.update(.6, 0); pinch.update(.6, 40); pinch.update(.1, 60); pinch.update(.1, 120);
    pinch.reset();
    expect(pinch.update(.1, 200)).toMatchObject({ phase: 'hover', armed: false, pressed: false });
  });
  it('measures distance in source pixels, independent of video aspect ratio', () => {
    const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: .5, y: .5, z: 0 }));
    points[5] = { x: .4, y: .5, z: 0 }; points[17] = { x: .6, y: .5, z: 0 };
    points[4] = { x: .5, y: .5, z: 0 }; points[8] = { x: .5, y: .6, z: 0 };
    expect(pinchRatio(points, { width: 1000, height: 500 })).toBeCloseTo(.25);
    expect(pinchRatio(points, { width: 500, height: 1000 })).toBeCloseTo(1);
    expect(pinchRatio(points, { width: 0, height: 500 })).toBeNull();
    expect(pinchRatio([], { width: 1000, height: 500 })).toBeNull();
  });
});
