import { describe, expect, it } from 'vitest';
import { createMockTrackingFrame } from './mock-tracking';

describe('createMockTrackingFrame', () => {
  it('emits an empty hands array for a frame with no hands', () => {
    const frame = createMockTrackingFrame(3, 120, 0);
    expect(frame.hands).toEqual([]);
  });

  it.each([1, 2] as const)('provides %i complete hand observations', (count) => {
    const frame = createMockTrackingFrame(1, 40, count);
    expect(frame.hands).toHaveLength(count);
    for (const hand of frame.hands) {
      expect(hand.landmarks).toHaveLength(21);
      expect(hand.handednessScore).toBe(1);
      for (const point of hand.landmarks) {
        expect(Number.isFinite(point.x)).toBe(true);
        expect(Number.isFinite(point.y)).toBe(true);
        expect(Number.isFinite(point.z)).toBe(true);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThanOrEqual(1);
        expect(point.y).toBeGreaterThanOrEqual(0);
        expect(point.y).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps the two hands spatially distinct in unmirrored source coordinates', () => {
    const frame = createMockTrackingFrame(0, 0, 2);
    const left = frame.hands[0]!;
    const right = frame.hands[1]!;
    expect(left.handedness).toBe('Left');
    expect(right.handedness).toBe('Right');
    expect(left.landmarks[0]!.x).toBeLessThan(0.5);
    expect(right.landmarks[0]!.x).toBeGreaterThan(0.5);
  });

  it('preserves frame identity and synthetic time without inventing inference work', () => {
    const frame = createMockTrackingFrame(7, 345.5, 1);
    expect(frame.frameId).toBe(7);
    expect(frame.sampledAtMs).toBe(345.5);
    expect(frame.receivedAtMs).toBe(345.5);
    expect(frame.inferenceMs).toBe(0);
    expect(frame.sourceSize).toEqual({ width: 1280, height: 720 });
  });

  it('generates independent snapshots so later consumers cannot corrupt old frames', () => {
    const first = createMockTrackingFrame(1, 10, 2);
    const saved = structuredClone(first);
    const next = createMockTrackingFrame(2, 20, 2);
    expect(first).toEqual(saved);
    expect(next.hands).not.toBe(first.hands);
    expect(next.hands[0]!.landmarks[0]).not.toBe(first.hands[0]!.landmarks[0]);
    expect(next.hands[0]!.landmarks[8]!.x).not.toBe(first.hands[0]!.landmarks[8]!.x);
  });
});
