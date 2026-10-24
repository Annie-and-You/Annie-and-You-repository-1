import { describe, expect, it } from 'vitest';
import { clientToVideo, createRectMapping, sourceToVideo } from './rect-mapping';

describe('rectangular surface coordinates', () => {
  it('mirrors source coordinates exactly once', () => {
    expect(sourceToVideo({ x: .2, y: .3 })).toEqual({ x: .8, y: .3 });
    expect(sourceToVideo({ x: -1, y: .3 })).toBeNull();
    expect(sourceToVideo({ x: NaN, y: .3 })).toBeNull();
  });
  it('round trips the same surface used for drawing and hitting', () => {
    const mapping = createRectMapping({ x: .1, y: .2, width: .8, height: .6 })!;
    const point = mapping.toVideo({ u: .25, v: .75 })!;
    expect(point.x).toBeCloseTo(.3);
    expect(point.y).toBeCloseTo(.65);
    expect(mapping.toPanel(point)!.u).toBeCloseTo(.25);
    expect(mapping.toPanel(point)!.v).toBeCloseTo(.75);
  });
  it('keeps off-panel positions for captured dragging and rejects nonfinite data', () => {
    const mapping = createRectMapping({ x: .1, y: .2, width: .8, height: .6 })!;
    expect(mapping.toPanel({ x: .5, y: .08 })!.v).toBeCloseTo(-.2);
    expect(mapping.toPanel({ x: Infinity, y: .2 })).toBeNull();
    expect(mapping.toVideo({ u: 0, v: NaN })).toBeNull();
  });
  it('rejects degenerate or off-video rectangles', () => {
    for (const rect of [
      { x: 0, y: 0, width: 0, height: .5 },
      { x: -.1, y: 0, width: .5, height: .5 },
      { x: .8, y: .2, width: .5, height: .5 },
      { x: 0, y: 0, width: .5, height: NaN },
    ]) expect(createRectMapping(rect)).toBeNull();
  });
  it('maps mouse input through contain black bars and permits captured movement outside', () => {
    const box = { left: 10, top: 20, width: 800, height: 800 };
    const source = { width: 800, height: 400 };
    expect(clientToVideo({ x: 410, y: 420 }, box, source)).toEqual({ x: .5, y: .5 });
    expect(clientToVideo({ x: 410, y: 100 }, box, source)).toBeNull();
    expect(clientToVideo({ x: 410, y: 100 }, box, source, true)!.y).toBeCloseTo(-.3);
    expect(clientToVideo({ x: 410, y: 420 }, { ...box, width: 0 }, source)).toBeNull();
  });
});
