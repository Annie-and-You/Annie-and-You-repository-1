import { describe, expect, it, vi } from 'vitest';
import { CameraSession } from './camera-session';

function fakeStream() {
  const stop = vi.fn();
  const track = { stop, getSettings: () => ({ width: 640, height: 480, frameRate: 30 }) };
  return { stop, stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream };
}

function fakeVideo() {
  return { srcObject: null, play: vi.fn().mockResolvedValue(undefined), pause: vi.fn() } as unknown as HTMLVideoElement;
}

describe('camera lifecycle', () => {
  it('requests video only and exposes actual settings, then releases the stream', async () => {
    const media = fakeStream();
    const getMedia = vi.fn().mockResolvedValue(media.stream);
    const camera = new CameraSession(getMedia);
    const video = fakeVideo();
    expect(await camera.start(video, '640')).toMatchObject({ width: 640, height: 480, frameRate: 30 });
    expect(getMedia).toHaveBeenCalledWith({ audio: false, video: { width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } } });
    camera.stop();
    expect(media.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });

  it('stops a late permission result and leaves a newer camera attached', async () => {
    const old = fakeStream();
    const current = fakeStream();
    let resolveOld!: (stream: MediaStream) => void;
    const getMedia = vi.fn().mockImplementationOnce(() => new Promise<MediaStream>((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(current.stream);
    const camera = new CameraSession(getMedia);
    const video = fakeVideo();
    const first = camera.start(video, '640');
    camera.stop();
    await camera.start(video, '720');
    resolveOld(old.stream);
    expect(await first).toBeNull();
    expect(old.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBe(current.stream);
    camera.stop();
  });

  it('releases tracks when playback fails and permits retry', async () => {
    const first = fakeStream();
    const second = fakeStream();
    const camera = new CameraSession(vi.fn().mockResolvedValueOnce(first.stream).mockResolvedValueOnce(second.stream));
    const video = fakeVideo();
    vi.mocked(video.play).mockRejectedValueOnce(new Error('play failed'));
    await expect(camera.start(video, '640')).rejects.toThrow('play failed');
    expect(first.stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
    await camera.start(video, '640');
    camera.stop();
    expect(second.stop).toHaveBeenCalledOnce();
  });

  it('rejects a camera that ended before the video became ready', async () => {
    const stop = vi.fn();
    const track = { readyState: 'ended', stop, getSettings: () => ({ width: 640, height: 480 }) };
    const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
    const camera = new CameraSession(async () => stream);
    const video = fakeVideo();
    await expect(camera.start(video, '640')).rejects.toThrow();
    expect(stop).toHaveBeenCalledOnce();
    expect(video.srcObject).toBeNull();
  });
});
