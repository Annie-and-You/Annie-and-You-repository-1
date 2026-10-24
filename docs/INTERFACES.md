# 共享接口草案 v0.1

状态日期：2026-10-24。**S0 已在 [src/shared/contracts.ts](../src/shared/contracts.ts) 落实追踪与单曲音频基础契约；其余章节仍含未来阶段草案。** 已落地：`Landmark`、`Size`、`HandObservation`、`TrackingFrame`、不含滤波的 `AudioCommand`／`AudioState`、`PlaybackStatus` 和 `AudioEngine` 类型。音频类型存在不表示引擎实现已完成。

共享代码类型是已实现部分的事实来源，此文档解释语义。`VideoPoint`、`PanelPoint`、面板映射、交互事件、滤波等按对应阶段落实，不提前制作全部功能。接口修改须同步更新类型、生产者、消费者、相关测试及本文件，并检查其他模块影响。

## 1. 坐标、时间和数值约定

| 名称 | 原点／方向／单位 | 使用约束 |
| --- | --- | --- |
| 源图像坐标 | 未镜像视频左上角；x 向右、y 向下，按源宽高归一化 | 只在追踪及映射适配层使用；越界结果不能直接触发控件 |
| `VideoPoint` | 镜像视频内容左上角；x 向右、y 向下，归一化 | 不包含黑边；镜像只转换一次 |
| `PanelPoint` | 面板左上角；u 向右、v 向下，归一化 | 面板内部为 0～1；已捕获拖动可暂时超出此范围 |
| 页面位置 | CSS 像素 | 鼠标先转换到视频内容区域；Canvas DPR 不改变逻辑坐标 |
| 关键点 z | 模型给出的手腕相对深度，非桌面高度 | 不用于判断真实触桌或距桌面厘米数 |
| `tMs`／`sampledAtMs`／`receivedAtMs` | 同一主线程 `performance.now()` 时间基准，毫秒 | sampled 表示软件采样时刻，不是传感器曝光时刻 |
| `inferenceMs` | Worker 内单次调用耗时，毫秒 | 仅作为时长，不与主线程时间原点直接相减 |
| 音频位置／时长 | 秒 | 不与交互毫秒或 `AudioContext.currentTime` 混用 |
| `value01`／`cutoff01` | 无量纲，有限数，0～1 | 音频模块统一映射；非有限值拒绝，边界超出值限制到合法区间 |

## 2. 摄像头与追踪输出

```ts
type VideoPoint = Readonly<{ x: number; y: number }>;
type PanelPoint = Readonly<{ u: number; v: number }>;
type Size = Readonly<{ width: number; height: number }>;
type Landmark = Readonly<{ x: number; y: number; z: number }>;

interface HandObservation {
  landmarks: readonly Landmark[]; // 每只手必须恰好 21 点
  handedness: "Left" | "Right" | "Unknown";
  handednessScore: number; // 仅左右分类分数，不是整体追踪精度
}

interface TrackingFrame {
  frameId: number;
  sampledAtMs: number;
  receivedAtMs: number;
  sourceSize: Size;
  hands: readonly HandObservation[];
  inferenceMs: number;
}
```

`frameId` 标识当前追踪服务产生的帧；旧会话、已停止 Worker 或过期请求的返回不得进入新会话。`receivedAtMs` 由主线程收到结果时填写。

没有手时发出 `hands: []`，而不是重复上一帧关键点。没有返回也需要观察超时，避免摄像头或 Worker 停止后抓取永久持续。

S0 的 `createMockTrackingFrame(frameId, sampledAtMs, handCount)` 提供零／一／两只手的独立样本，每手 21 点，源尺寸为 1280×720。`receivedAtMs = sampledAtMs`、`inferenceMs = 0`、左右分类分数为 1 都是模拟值，不代表真实检测置信度、分辨率或性能；真实适配器需在 S1 独立实现。

摄像头、模型各自提供开始／停止状态与可恢复错误，不混入关键点数组。初始化、权限拒绝、摄像头占用、模型失败和 Worker 失败应可区分，音频模块不订阅这些设备细节。

`HandObservation` 不承诺稳定 ID。交互层结合空间连续性和左右分类提示生成会话内指针标识，不把数组下标当身份。左右标签应经过真实左手／右手测试，不能仅凭镜像假设解释。

## 3. 面板映射与校准

```ts
interface SurfaceMapping {
  toVideo(point: PanelPoint): VideoPoint | null;
  toPanel(point: VideoPoint): PanelPoint | null;
}

interface CalibrationState {
  mode: "rect" | "quad";
  corners: readonly [VideoPoint, VideoPoint, VideoPoint, VideoPoint];
  // 顺序：面板左上、右上、右下、左下
  sourceSize: Size;
  mirrored: true;
}
```

矩形阶段四角形成矩形；透视阶段使用四角计算正反投影。渲染和命中必须使用同一份映射，不能分别维护近似变换。

`null` 表示该映射无法产生有效坐标，不能用上一次位置继续操作。四角交叉、退化或过度压扁时拒绝新校准，保留之前有效状态；尚无有效状态时不启用手势控件。

鼠标编辑校准时先取消全部抓取；变更后重新激活。用户调整机位需主动重新确认／校准。相机或视频尺寸变化使旧状态需要重新确认；仅窗口变化重算 CSS 映射，并取消抓取以避免跳值。持久化校准只存本地，不代表系统能自动发现摄像机移动。

## 4. 交互事件与控件

```ts
type PointerPhase = "hover" | "down" | "move" | "up" | "cancel";
type CancelReason =
  | "tracking-lost"
  | "ambiguous-hand"
  | "mapping-changed"
  | "input-takeover"
  | "session-stopped";

interface InteractionPointerEvent {
  pointerId: string;
  source: "hand" | "mouse";
  phase: PointerPhase;
  tMs: number;
  point?: PanelPoint; // cancel 可无位置；其余阶段必须有有效位置
  reason?: CancelReason; // cancel 必填
}
```

键盘不需要伪造二维指针；通过控件动作产生相同的音频指令。`pointerId` 仅在当前会话中区分输入，不是跨会话身份或个人标识。

事件规则：

- 必须先观察到张开，再允许捏合产生 `down`；初始捏合和丢手重现不激活。
- `down` 只在捏合状态转换时发出一次；持有期间发 `move`，松开产生一次 `up`。
- 无效或丢失位置立即停止更新参数；超时、映射变化、实体输入接管或停止会话产生 `cancel`，不能用 `up` 代替取消来误触按钮。
- 按钮在原按钮内 `up` 时激活一次；移出后松开或取消不激活。
- 推子在有效抓取区域 `down` 时保存初始值和抓取偏移，捕获后允许移出控件继续拖动；只限制最终控件值，不提前把指针钳制到面板边缘。
- 释放后保持当前参数；追踪丢失不自动暂停音乐。恢复须先张开。

`ControlLayout` 至少描述控件 ID、类型、面板局部命中区域和是否可用。渲染与命中读取同一份布局。垂直推子向上增大数值；具体像素尺寸、命中扩展和手势阈值由实验确定。

双手阶段增加独立指针状态及 `controlId → pointerId` 的占用关系：每指针最多抓一个控件，每控件最多一个所有者。事件按时间处理，同帧冲突使用稳定的指针标识顺序。第二只手不能抢占；身份不明确时取消相关指针，一只手丢失不取消另一只手。

## 5. 音频控制与真实状态

以下展示包含滤波阶段的目标草案。MVP 代码仅实现 `setPlayback`、`setVolume`；加入滤波时在同一变更中扩展实际类型、实现、测试与文档。

```ts
type AudioCommand =
  | { type: "setPlayback"; playing: boolean }
  | { type: "setVolume"; value01: number }
  | { type: "setFilter"; enabled: boolean; cutoff01: number };

type PlaybackStatus =
  | "empty" | "loading" | "ready" | "playing"
  | "paused" | "ended" | "error";

interface AudioState {
  status: PlaybackStatus;
  fileName: string | null;
  positionSeconds: number;
  durationSeconds: number | null;
  volume01: number;
  filter?: { enabled: boolean; cutoff01: number }; // 滤波阶段加入
  error?: { code: string; message: string };
}

interface AudioEngine {
  load(file: File): Promise<void>;
  dispatch(command: AudioCommand): Promise<void>;
  subscribe(listener: (state: AudioState) => void): () => void;
  dispose(): void;
}
```

- 文件只交给本地音频模块，不放进追踪 Worker 消息或上传接口。取消文件选择不替换现有曲目。
- `load()` 取消旧曲播放并重置时间，加载成功为 `ready`，不自动播放。并发加载以最新选择为准，旧完成或错误不能覆盖新状态。
- `setPlayback` 表达期望状态，重复同一命令不重复切换；`playing` 只在媒体真实开始播放后成立。播放结束为 `ended`，再次播放从头开始。
- `dispatch()` 失败必须可见且可恢复。UI 不在 `play()` 被拒绝时显示“正在播放”；首次真实点击／按键负责音频启用。
- `volume01` 默认 0.5，映射到 0～1 线性增益；0 为静音，1 为单位增益。高频参数采用最新值和平滑，不排队回放旧值。
- 滤波默认旁路，初始 `cutoff01 = 1`。映射为 `f = 80 × (fMax / 80) ^ cutoff01` Hz，`fMax = min(18000, 0.45 × sampleRate)`；0 表示 80 Hz，不表示静音。滤波启用状态由明确的控件动作改变。
- 控件不直接设置媒体元素音量或 Web Audio 节点，所有音频参数映射集中于引擎。
- `subscribe()` 返回取消订阅函数；`dispose()` 释放节点、对象 URL 与监听，且不得让未完成请求再次发布有效状态。

## 6. 兼容演进与验证

草案允许随实验修订，不承诺版本化网络协议。当前没有后端 API、WebSocket 协议或双音轨字段，也不提前实现它们。

接口变更需说明改变了哪个行为、影响哪些消费者；同一 PR 同步代码类型、调用处、测试和此文档。关键检查覆盖：镜像与黑边、尺寸变化、透视正反映射、非法校准、捏合滞回、取消不触发按钮、抓取偏移、双手占用、换曲竞争和播放失败。

原始追踪点、左右分类和相对 z 都不是精度保证；验收数值与真实设备结果集中记录在[项目计划](PROJECT_PLAN.md)。
