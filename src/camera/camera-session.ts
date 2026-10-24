export type ResolutionPreset = '640' | '720';

/** Owns only the stream; tracking and rendering have separate lifecycles. */
export class CameraSession {
  private generation = 0;
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  constructor(private getMedia = (constraints: MediaStreamConstraints) => navigator.mediaDevices.getUserMedia(constraints)) {}

  async start(video: HTMLVideoElement, preset: ResolutionPreset): Promise<MediaTrackSettings | null> {
    this.stop();
    const generation = this.generation;
    const stream = await this.getMedia({
      audio: false,
      video: {
        width: { ideal: preset === '640' ? 640 : 1280 },
        height: { ideal: preset === '640' ? 480 : 720 },
        frameRate: { ideal: 30 },
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((track) => track.stop());
      return null;
    }
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    try {
      await video.play();
      if (generation !== this.generation) return null;
      const track = stream.getVideoTracks()[0];
      if (!track || track.readyState === 'ended') throw new DOMException('Camera stream ended during startup', 'NotReadableError');
      return track.getSettings();
    } catch (error) {
      if (generation !== this.generation) return null;
      this.stop();
      throw error;
    }
  }

  stop(): void {
    this.generation++;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video = null;
    }
  }
}
