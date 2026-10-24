# S1 摄像头实验与进度记忆实施计划

> **For agentic workers:** 使用 superpowers:executing-plans 在当前会话逐项执行；沿用项目已确定的 S1 范围。

**Goal:** 接续 S0，交付可在 Edge 运行的本地摄像头／手部追踪实验台，并将协作进度移到独立文件。

**Architecture:** 保留 S0 模拟输入。摄像头生命周期与追踪 Worker 分离；主线程同时只发送一帧，Canvas 独立绘制，React 只接收低频诊断快照。运行资源全部同源本地提供。

**Tech Stack:** 现有严格 TypeScript、React、Vite、Vitest，固定版本 MediaPipe Tasks Vision、Web Worker、Canvas 2D。

**Spec:** [PROJECT_PLAN 的 S1](../../PROJECT_PLAN.md)、[ARCHITECTURE](../../ARCHITECTURE.md)、[INTERFACES](../../INTERFACES.md)；用户本轮授权接手并继续既定阶段，指定 frontend-design 重做前端。

## Global Constraints

- 不上传媒体、不申请麦克风；摄像头只在用户点击后启用，停止释放轨道和 Worker。
- 同时只处理一帧；停止、隐藏与重启使旧结果失效，图像资源必须释放。
- 统计实际视频设置与软件采样到返回耗时；推理耗时单列，不宣称端到端延迟。
- 单手和双手配置分别测；S1 实机未验收时保持待验证，不延伸到音频、捏合或透视。
- docs/PROGRESS.md 是进度入口；README 保留使用说明，PROJECT_PLAN 保留验收定义。

## 视觉方案（frontend-design）

录音室监听台：蓝灰工作台与深蓝画面，琥珀色标记用户操作，蓝色用于追踪状态；不用均匀卡片网格和荧光绿装饰。

- 色彩：机壳 `#e5eaf0`、纸面 `#f5f7fa`、墨色 `#182638`、画面 `#142b43`、琥珀 `#f4b65a`、信号蓝 `#236bc4`。
- 字体：本机 Bahnschrift 用于大标题和数值，等线／微软雅黑用于中文；不依赖外部字体服务，不用全大写小标签。
- 布局：标题短而明确；主视窗占宽度约 3/4，右侧是一列精简诊断，下方集中配置与启停。移动端按视窗、配置、诊断顺序堆叠。

```text
Gesture DJ                             本地处理
让双手进入画面。                     摄像头实验
┌───────────────────────────────┬──────────┐
│                               │ 会话状态 │
│       镜像摄像头／骨架         │ 视频设置 │
│                               │ 性能诊断 │
├───────────────────────────────┴──────────┤
│ 输入来源 · 分辨率 · CPU/GPU · 手数 · 启停 │
└──────────────────────────────────────────┘
```

比较后舍弃唱盘装饰与夜店荧光：当前任务是检查机位和识别，画面本身应成为视觉中心；用镜头取景与刻度感表达主题，周围保持克制。保留可见焦点、足够对比度、窄屏布局和 reduced-motion。

## Review Focus

- 启动请求尚未返回时停止／重启：迟到流必须停止，旧结果不能污染新会话。
- 权限拒绝、设备占用、模型／Worker 失败：可读提示并能重新启用；资源不泄漏。
- 图像采样未完成又收到新帧：不积压；停止后释放迟到 bitmap。
- 页面隐藏或摄像头断开：清除骨架、停止采样；统计不得继续显示过时的有效频率。
- 单手与双手混用、无手／越界数据：分别统计，不把模型返回数当有效指针数。

## Task 1：记忆迁移与 S0 复现

- [x] 拉取并核对伙伴 S0，在独立功能分支接续，保留用户交接文件。
- [x] 新建 `docs/PROGRESS.md`；同步 AGENTS、README、PROJECT_PLAN、交接索引的职责和阅读入口。
- [x] 使用指定 Node/npm 完成 `npm ci`、`npm run check`；期望 6 测试通过、类型/lint/构建成功，记录本机证据。

## Task 2：摄像头、追踪调度与诊断

**Files:** `src/camera/camera-session.ts`、`src/tracking/frame-gate.ts`、`src/tracking/diagnostics.ts`、相邻 `.test.ts`、`src/tracking/tracking-worker.ts`、`src/tracking/worker-protocol.ts`、`scripts/prepare-tracking-assets.mjs`、依赖与许可。

**Interfaces:** 沿用 `TrackingFrame`／`HandObservation`；`FrameGate.begin(): number | null`、`finish(ticket): boolean`、`reset(): void` 保证单帧与会话隔离；`TrackingDiagnostics.record(frame)`、`snapshot(now)` 聚合手数、有效帧率和 p50/p95。相机 `CameraSession.start(video, preset)`／`stop()` 管理迟到 stream 与轨道。

- [x] 先写有行为价值的测试：忙时跳帧、旧会话不释放新帧；有效指针与无手、坏点、越界；停机后迟到流释放、权限错误可重试。运行观察失败。
- [x] 实现以上小模块，运行测试转绿。再接固定版本 MediaPipe Worker：VIDEO、1/2 手、CPU/GPU、初始化和推理失败的 GPU→CPU 回退、图像 finally 释放。
- [x] 本地准备固定 URL／校验值模型与 npm 包 WASM，构建中包含许可；不使用运行时 CDN。

## Task 3：实验台集成、验证与交付记录

**Files:** `src/ui/CameraExperiment.tsx`、`src/tracking/tracking-session.ts`、`src/ui/draw-tracking.ts`、`src/App.tsx`、`src/styles.css` 与对应文档。

**Interfaces:** session 接受 video/canvas、配置和低频状态回调；统一 `TrackingFrame` 输入绘制器。帧结果不写进整棵 React 树。

- [x] 先测 session 的停止／迟到 bitmap、旧 Worker 返回、帧请求失败与清理行为，观察红灯后实现。
- [x] 摄像头按钮显式启用，640/720p、CPU/GPU、1/2 手配置，显示实际设置、有效频率与耗时；保留模拟模式和明确标识。
- [x] 实现视觉方案并在实际浏览器检查初始页、模拟输入、错误恢复、停止、窄屏；使用虚拟摄像头时明确区别于真实实机验收。
- [x] `npm run check`、Markdown 链接、资产校验、生产页面与 Worker 验证；记录实测边界，更新 PROGRESS 和阶段交接。
