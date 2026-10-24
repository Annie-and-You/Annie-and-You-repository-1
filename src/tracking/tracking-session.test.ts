import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrackingSession } from './tracking-session';
import type { WorkerReply, WorkerRequest } from './worker-protocol';
import { createMockTrackingFrame } from './mock-tracking';

afterEach(() => vi.useRealTimers());

function fixture(capture = vi.fn().mockResolvedValue({ close: vi.fn() })) {
  const worker = {
    onmessage: null as ((event: MessageEvent<WorkerReply>) => void) | null,
    onerror: null as (() => void) | null,
    postMessage: vi.fn<(message: WorkerRequest, transfer?: Transferable[]) => void>(),
    terminate: vi.fn(),
  };
  let tick: (() => void) | null = null;
  const cancel = vi.fn();
  const frame = vi.fn();
  const state = vi.fn();
  const video = { videoWidth: 640, videoHeight: 480 } as HTMLVideoElement;
  const session = new TrackingSession(video, { delegate: 'CPU', numHands: 1 }, { frame, state }, {
    createWorker: () => worker,
    capture,
    now: () => 100,
    schedule: (_video, callback) => { tick = callback; return cancel; },
  });
  const reply = (data: WorkerReply) => worker.onmessage?.({ data } as MessageEvent<WorkerReply>);
  const advance = () => { const callback = tick!; tick = null; callback(); };
  return { session, worker, reply, advance, cancel, frame, state, capture };
}

describe('tracking session boundary', () => {
  it('transfers only one bitmap while busy, then accepts the matching result', async () => {
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    f.advance();
    await Promise.resolve();
    f.advance();
    expect(f.capture).toHaveBeenCalledTimes(1);
    const request = f.worker.postMessage.mock.calls.find(([message]) => message.type === 'frame')![0];
    if (request.type !== 'frame') throw new Error('frame expected');
    f.reply({ type: 'result', ticket: request.ticket, hands: [], inferenceMs: 3 });
    expect(f.frame).toHaveBeenCalledWith(expect.objectContaining({ hands: [], sampledAtMs: 100, receivedAtMs: 100 }));
    f.advance();
    await Promise.resolve();
    expect(f.capture).toHaveBeenCalledTimes(2);
    f.session.stop();
  });

  it('closes a late bitmap after stop without posting it to a terminated worker', async () => {
    let finish!: (bitmap: ImageBitmap) => void;
    const close = vi.fn();
    const f = fixture(vi.fn(() => new Promise<ImageBitmap>((resolve) => { finish = resolve; })));
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    f.advance();
    f.session.stop();
    finish({ close } as unknown as ImageBitmap);
    await Promise.resolve();
    expect(close).toHaveBeenCalledOnce();
    expect(f.worker.postMessage.mock.calls.filter(([message]) => message.type === 'frame')).toHaveLength(0);
    f.reply({ type: 'result', ticket: 1, hands: createMockTrackingFrame(1, 100, 1).hands, inferenceMs: 4 });
    expect(f.frame).toHaveBeenLastCalledWith(null);
    expect(f.worker.terminate).toHaveBeenCalledOnce();
  });

  it('clears the overlay and releases its worker when capture fails', async () => {
    const f = fixture(vi.fn().mockRejectedValue(new Error('capture failed')));
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    f.advance();
    await Promise.resolve();
    await Promise.resolve();
    expect(f.frame).toHaveBeenLastCalledWith(null);
    expect(f.state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(f.worker.terminate).toHaveBeenCalledOnce();
  });

  it('stops a stalled inference rather than retaining an old skeleton forever', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    f.advance();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(f.frame).toHaveBeenLastCalledWith(null);
    expect(f.worker.terminate).toHaveBeenCalledOnce();
  });

  it('detects a video stream that never produces its next frame', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(f.worker.terminate).toHaveBeenCalledOnce();
  });

  it('clears stale hand positions while waiting for another frame', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    f.advance();
    await Promise.resolve();
    f.reply({ type: 'result', ticket: 1, hands: [], inferenceMs: 4 });
    expect(f.frame).toHaveBeenLastCalledWith(expect.objectContaining({ frameId: 1 }));
    await vi.advanceTimersByTimeAsync(150);
    expect(f.frame).toHaveBeenLastCalledWith(null);
    f.session.stop();
  });

  it('discards the GPU failure frame before beginning CPU measurements', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'GPU', fallback: false });
    f.advance();
    await Promise.resolve();
    f.reply({ type: 'fallback', delegate: 'CPU', ticket: 1 });
    f.advance();
    await Promise.resolve();
    expect(f.capture).toHaveBeenCalledTimes(2);
    f.reply({ type: 'result', ticket: 2, hands: [], inferenceMs: 8 });
    await vi.advanceTimersByTimeAsync(500);
    expect(f.state).toHaveBeenLastCalledWith(expect.objectContaining({
      delegate: 'CPU', fallback: true, metrics: expect.objectContaining({ processed: 1, inferenceP95: 8 }),
    }));
    f.session.stop();
  });

  it('keeps the measured hand configuration with a stopped result', () => {
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'CPU', fallback: false });
    f.session.stop();
    expect(f.state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'stopped', numHands: 1 }));
  });

  it('retains the no-video watchdog after runtime GPU fallback', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.session.start();
    f.reply({ type: 'ready', delegate: 'GPU', fallback: false });
    f.advance();
    await Promise.resolve();
    f.reply({ type: 'fallback', delegate: 'CPU', ticket: 1 });
    await vi.advanceTimersByTimeAsync(10000);
    expect(f.state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'error' }));
    expect(f.worker.terminate).toHaveBeenCalledOnce();
  });
});
