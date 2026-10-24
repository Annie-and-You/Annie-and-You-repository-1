import { describe, expect, it } from 'vitest';
import { FrameGate } from './frame-gate';

describe('single in-flight frame', () => {
  it('skips new frames until the matching request finishes', () => {
    const gate = new FrameGate();
    const ticket = gate.begin()!;
    expect(gate.begin()).toBeNull();
    expect(gate.finish(ticket + 1)).toBe(false);
    expect(gate.begin()).toBeNull();
    expect(gate.finish(ticket)).toBe(true);
    expect(gate.begin()).not.toBeNull();
  });

  it('ignores a late result without releasing a new session request', () => {
    const gate = new FrameGate();
    const old = gate.begin()!;
    gate.reset();
    const current = gate.begin()!;
    expect(gate.finish(old)).toBe(false);
    expect(gate.begin()).toBeNull();
    expect(gate.finish(current)).toBe(true);
  });
});
