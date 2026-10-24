# 共享接口草案 v0.1

状态日期：2026-10-24。**[src/shared/contracts.ts](../src/shared/contracts.ts) 已落实追踪、S2 矩形映射／交互事件和单曲音频基础契约；透视与滤波章节仍含未来阶段草案。** 音频类型存在不表示引擎实现已完成。

共享代码类型是已实现部分的事实来源，此文档解释语义。已实现 `VideoPoint`、`PanelPoint`、`VideoRect`、`PanelRect`、`SurfaceMapping`、`InteractionPointerEvent`、`CancelReason`、`ControlId` 和 `ControlLayout`；`CalibrationState` 与滤波按后续阶段落实。接口修改须同步更新类型、生产者、消费者、相关测试及本文件，并检查其他模块影响。

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

`createMockTrackingFrame(frameId, sampledAtMs, handCount)` 提供零／一／两只手的独立样本，每手 21 点，源尺寸为 1280×720。`receivedAtMs = sampledAtMs`、`inferenceMs = 0`、左右分类分数为 1 都是模拟值，不代表真实检测置信度、分辨率或性能。

S1 Worker 使用同一个 `TrackingFrame` 契约；内部消息类型在 [worker-protocol.ts](../src/tracking/worker-protocol.ts)。主线程只发送一个在途 `ticket`，记录采样时间与视频尺寸；Worker 返回手部数据和内部推理时长，接收时间由主线程填写。票据不在闸门重置后复用；每轮使用新 Worker，关闭后不接受旧消息。GPU 运行失败发送带票据的 `fallback`，丢弃该帧，CPU 从新一轮统计开始。

`TrackingConfig` 只含 `delegate: 'GPU' | 'CPU'`、`numHands: 1 | 2`；它是追踪模块内部配置，不扩展音频契约。`TrackingStatus` 的低频状态与 `DiagnosticSnapshot` 聚合统计见 [tracking-session.ts](../src/tracking/tracking-session.ts) 与 [diagnostics.ts](../src/tracking/diagnostics.ts)。返回帧比例与累计有效频率的定义见 README，不把左右分类分数当有效率。

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

S2 使用 [rect-mapping.ts](../src/interaction/rect-mapping.ts) 的 `createRectMapping(VideoRect): SurfaceMapping | null`。`VideoRect` 的 `x/y/width/height` 位于镜像视频归一化坐标，范围内有效矩形生成同一正反映射；`toPanel` 不钳制边界。`sourceToVideo` 仅做一次 x 镜像并拒绝越界源点；`clientToVideo` 按实际视频尺寸排除 `object-fit: contain` 黑边，捕获期间允许鼠标超出内容区域。SVG 使用相同源宽高和 `xMidYMid meet`。

`null` 表示该映射无法产生有效坐标，不能用上一次位置继续操作。四角交叉、退化或过度压扁时拒绝新校准，保留之前有效状态；尚无有效状态时不启用手势控件。

鼠标编辑校准时先取消全部抓取；变更后重新激活。用户调整机位需主动重新确认／校准。相机或视频尺寸变化使旧状态需要重新确认；仅窗口变化重算 CSS 映射，并取消抓取以避免跳值。持久化校准只存本地，不代表系统能自动发现摄像机移动。

## 4. 交互事件与控件

```ts
type CancelReason =
  | "tracking-lost"
  | "ambiguous-hand"
  | "mapping-changed"
  | "input-takeover"
  | "session-stopped";

type InteractionPointerEvent = Readonly<{
  pointerId: string;
  source: "hand" | "mouse";
  tMs: number;
} & (
  | { phase: "hover" | "down" | "move" | "up"; point: PanelPoint }
  | { phase: "cancel"; reason: CancelReason }
)>;
```

键盘不需要伪造二维指针；通过控件动作产生相同的音频指令。`pointerId` 仅在当前会话中区分输入，不是跨会话身份或个人标识。

事件规则：

- 必须先观察到张开五指，再允许五指聚拢产生 `down`；初始抓拢和丢手重现不激活。
- `down` 只在五指聚拢状态转换时发出一次；持有期间发 `move`，张开产生一次 `up`。
- 无效或丢失位置立即停止更新参数；超时、映射变化、实体输入接管或停止会话产生 `cancel`，不能用 `up` 代替取消来误触按钮。
- 按钮在原按钮内 `up` 时激活一次；移出后松开或取消不激活。
- 推子在有效抓取区域 `down` 时保存初始值和抓取偏移，捕获后允许移出控件继续拖动；只限制最终控件值，不提前把指针钳制到面板边缘。
- 释放后保持当前参数；追踪丢失不自动暂停音乐。恢复须先张开。

`ControlLayout` 至少描述控件 ID、类型、面板局部命中区域和是否可用。渲染与命中读取同一份布局。垂直推子向上增大数值；具体像素尺寸、命中扩展和手势阈值由实验确定。

S2 的 [control-lab.ts](../src/controls/control-lab.ts) 输出 `LAB_LAYOUT`，当前 ID 为 `test-a`、`test-b`、`level`；每项为 `{ id, kind: 'button' | 'fader', bounds: PanelRect, enabled }`。`ControlLab.dispatch(InteractionPointerEvent)` 更新只读 `snapshot`，包含按钮次数、推子值、捕获控件和最近取消原因；这些是实验数据，不是音频状态，也不隐含成功率。

[pinch.ts](../src/interaction/pinch.ts) 现实现五指向前聚拢的试验判定：取指尖 4／8／12／16／20 中任意两点的最大源像素距离，除以掌部尺度 `max(5→17 掌宽, 0→9 掌长)`，得到聚拢比；不再只看拇指与食指接触。闭合 ≤0.75 持续 60 ms，张开 ≥1.15 持续 40 ms，滞回带保持当前状态。初始张开也要稳定观察 40 ms。掌部尺度过小或点位无效时拒绝输入；平滑时间常数 45 ms，使用 `1-exp(-dt/45)`，不按固定帧数防抖。以上均为待真人调优的工程初值。只衡量二维指尖聚集，不能区分全部握拳、遮挡或前后深度形态；没有训练或增加手势分类模型。

交互光标取掌部 0／5／9／13／17 的二维均值，镜像一次后平滑及映射，避免五指收拢本身带动食指光标。骨架中的五个白色指尖点只供观察，掌心圆环才是命中与拖动的位置。

[single-hand-pointer.ts](../src/interaction/single-hand-pointer.ts) 只保留一个当前掌部关联，以邻近距离和高可信左右分类辅助；不以数组顺序当身份。首次多手不激活、近似候选不明确则取消。多手变为少手时，若剩余候选可能继承原抓取则保守取消，即使实际离开的是旁观手；代价是需多一次张开确认。结果年龄或相邻采样间隔超过 150 ms、无完整有效手、源尺寸改变都会取消；重复或倒序帧忽略。停止、窗口缩放、面板调整和实体输入接管由界面主动取消。重新取得手后必须重新观察张开。这是保守单手实验，不能作为 S5 双手身份实现。

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
