/** 源视频坐标尚未镜像；z 是模型相对深度，不代表距桌面高度。 */
export type Landmark = Readonly<{ x: number; y: number; z: number }>;
export type Size = Readonly<{ width: number; height: number }>;

export interface HandObservation {
  readonly landmarks: readonly Landmark[];
  readonly handedness: 'Left' | 'Right' | 'Unknown';
  /** 仅左右分类分数，不是整体追踪质量。 */
  readonly handednessScore: number;
}

export interface TrackingFrame {
  readonly frameId: number;
  /** 主线程 performance.now() 时间基准。 */
  readonly sampledAtMs: number;
  readonly receivedAtMs: number;
  readonly sourceSize: Size;
  readonly hands: readonly HandObservation[];
  /** Worker 内耗时；模拟样本为 0，不能当作实测性能。 */
  readonly inferenceMs: number;
}

export type VideoPoint = Readonly<{ x: number; y: number }>;
export type PanelPoint = Readonly<{ u: number; v: number }>;
export type VideoRect = Readonly<{ x: number; y: number; width: number; height: number }>;
export type PanelRect = Readonly<{ u: number; v: number; width: number; height: number }>;

export interface SurfaceMapping {
  toVideo(point: PanelPoint): VideoPoint | null;
  toPanel(point: VideoPoint): PanelPoint | null;
}

export type CancelReason = 'tracking-lost' | 'ambiguous-hand' | 'mapping-changed' | 'input-takeover' | 'session-stopped';
export type InteractionPointerEvent = Readonly<{
  pointerId: string;
  source: 'hand' | 'mouse';
  tMs: number;
} & ({ phase: 'hover' | 'down' | 'move' | 'up'; point: PanelPoint } | { phase: 'cancel'; reason: CancelReason })>;

export type ControlId = 'test-a' | 'test-b' | 'level';
export type ControlLayout = readonly Readonly<{
  id: ControlId;
  kind: 'button' | 'fader';
  bounds: PanelRect;
  enabled: boolean;
}>[];

/** A1 只实现单曲播放与音量；滤波在 S4 同步扩展。 */
export type AudioCommand =
  | { readonly type: 'setPlayback'; readonly playing: boolean }
  | { readonly type: 'setVolume'; readonly value01: number };

export type PlaybackStatus =
  | 'empty'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface AudioState {
  readonly status: PlaybackStatus;
  readonly fileName: string | null;
  readonly positionSeconds: number;
  readonly durationSeconds: number | null;
  readonly volume01: number;
  readonly error?: Readonly<{ code: string; message: string }>;
}

export interface AudioEngine {
  load(file: File): Promise<void>;
  dispatch(command: AudioCommand): Promise<void>;
  subscribe(listener: (state: AudioState) => void): () => void;
  dispose(): void;
}
