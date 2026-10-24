import { describe, expect, it } from 'vitest';
import { GESTURE_PARAMETERS, Pinch, pinchRatio } from './pinch';
import type { Landmark } from '../shared/contracts';

const closed = .3, open = 1.4, between = .9;

describe('five-finger pinch hysteresis and time debounce', () => {
  it('requires stable open before an initial closed hand can activate', () => {
    const pinch = new Pinch();
    expect(pinch.update(.1, 0).armed).toBe(false);
    expect(pinch.update(.1, 100).phase).toBe('hover');
    pinch.update(open, 120);
    expect(pinch.update(open, 160).armed).toBe(true);
    pinch.update(.1, 180);
    expect(pinch.update(.1, 240).phase).toBe('down');
    expect(pinch.update(.1, 280).phase).toBe('move');
    pinch.update(open, 300);
    expect(pinch.update(open, 340).phase).toBe('up');
    expect(pinch.update(open, 400).phase).toBe('hover');
  });
  it('ignores brief closure and maintains a hold in the hysteresis band', () => {
    const pinch = new Pinch();
    pinch.update(open, 0); pinch.update(open, 40);
    pinch.update(closed, 50); pinch.update(between, 80);
    expect(pinch.update(closed, 100).phase).toBe('hover');
    expect(pinch.update(closed, 160).phase).toBe('down');
    expect(pinch.update(between, 220).phase).toBe('move');
    pinch.update(open, 240); pinch.update(between, 260);
    expect(pinch.update(open, 280).phase).toBe('move');
    expect(pinch.update(open, 320).phase).toBe('up');
  });
  it('reset requires a fresh open observation', () => {
    const pinch = new Pinch();
    pinch.update(open, 0); pinch.update(open, 40); pinch.update(closed, 60); pinch.update(closed, 120);
    pinch.reset();
    expect(pinch.update(.1, 200)).toMatchObject({ phase: 'hover', armed: false, pressed: false });
  });
  it('measures distance in source pixels, independent of video aspect ratio', () => {
    const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: .5, y: .5, z: 0 }));
    points[5] = { x: .4, y: .5, z: 0 }; points[17] = { x: .6, y: .5, z: 0 };
    points[0] = { x: .5, y: .6, z: 0 };
    points[4] = { x: .5, y: .5, z: 0 }; points[20] = { x: .5, y: .6, z: 0 };
    expect(pinchRatio(points, { width: 1000, height: 500 })).toBeCloseTo(.25);
    expect(pinchRatio(points, { width: 500, height: 1000 })).toBeCloseTo(1);
    expect(pinchRatio(points, { width: 0, height: 500 })).toBeNull();
    expect(pinchRatio([], { width: 1000, height: 500 })).toBeNull();
  });
  it.each([4, 8, 12, 16, 20])('requires fingertip %i to join the cluster, not only thumb/index contact', (tip) => {
    const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: .5, y: .35, z: 0 }));
    points[5] = { x: .4, y: .5, z: 0 }; points[17] = { x: .6, y: .5, z: 0 };
    points[0] = { x: .5, y: .6, z: 0 }; points[9] = { x: .5, y: .45, z: 0 };
    const size = { width: 1000, height: 1000 };
    expect(pinchRatio(points, size)).toBeLessThanOrEqual(GESTURE_PARAMETERS.closeRatio);
    points[tip] = { x: .8, y: .35, z: 0 };
    expect(pinchRatio(points, size)).toBeGreaterThanOrEqual(GESTURE_PARAMETERS.openRatio);
  });
  it('uses a stable palm length when projected palm width narrows and rejects degenerate input', () => {
    const points: Landmark[] = Array.from({ length: 21 }, () => ({ x: .5, y: .3, z: 0 }));
    points[0] = { x: .5, y: .6, z: 0 }; points[9] = { x: .5, y: .4, z: 0 };
    points[5] = { x: .49, y: .45, z: 0 }; points[17] = { x: .51, y: .45, z: 0 };
    points[20] = { x: .6, y: .3, z: 0 };
    const size = { width: 1000, height: 1000 };
    expect(pinchRatio(points, size)).toBeCloseTo(.5);
    points[16] = { x: NaN, y: .3, z: 0 };
    expect(pinchRatio(points, size)).toBeNull();
    expect(pinchRatio(Array.from({ length: 21 }, () => ({ x: .5, y: .5, z: 0 })), size)).toBeNull();
  });
});
