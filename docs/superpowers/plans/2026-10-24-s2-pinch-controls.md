# S2 单手按钮与推子实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有摄像头实验台上加入可移动、缩放的二维面板、两个测试按钮和一个推子，验证单手捏合的完整生命周期。

**Architecture:** 追踪输出经同一矩形映射进入单手指针，再由控件状态机消费事件；两层均为纯 TypeScript，不依赖 React、MediaPipe 或音频。Canvas 绘制骨架，SVG 依据同一布局和映射绘制交互面板；帧级更新局限于实验面板，不重渲染整个应用。

**Tech Stack:** 现有 React / TypeScript / Canvas / SVG / Vitest，不增加依赖。

**Spec:** [PROJECT_PLAN 的 S2](../../PROJECT_PLAN.md#s2单手按钮与推子)、[INTERFACES](../../INTERFACES.md) 与用户本轮“推进到下一阶段”的请求。

## Global Constraints

- 用户已确认当前设备基本识别双手；这是主观初测，S1 的两机量化验收仍待做，不将其升级为完成。
- 本轮只做 S2；音乐、透视、双手独立控制在后续阶段。
- 保留现有 frontend-design 色彩、字体和工作台布局；大控件叠在视频内，配置和说明在下方，避免重复设计整页。
- 在当前工作目录串行开发，基于 `1bb5ad7` 创建 `codex/s2-pinch-controls`；不推送或合并。
- 记录本地聚合按钮次数、推子值和最近取消原因；不保存原始媒体或点位历史，不伪造真人成功率。

## 设计选择

采用视频归一化矩形与局部控件坐标，正反映射共用；未捕获指针不钳制，捕获后允许拖出面板。直接把 CSS 像素作为交互坐标会在缩放时漂移；提前做透视会超出 S2，因此都不采用。这些是开发实现选择，并非用户逐项确认的参数。

面板初始为镜像视频的 `{x: .08, y: .18, width: .84, height: .66}`。两个宽按钮在左、垂直推子在右；沿用深蓝画面、浅蓝面板线、琥珀抓取色。调位置/大小用可访问的原生范围输入，进入调整模式先取消抓取，完成后先张开重新激活。

捏合用处理宽高比后的拇指尖至食指尖距离 / 掌宽，初值闭合 ≤ .32、张开 ≥ .52，闭合稳定 60 ms、张开稳定 40 ms；食指用时间常数 45 ms 的指数平滑。上述是待实机调优的初值，不是已通过的指标。匹配掌部连续性并用高可信左右分类辅助，不以数组下标当身份；初次两手不明确时要求先留一只手，歧义立即取消，不实现 S5 身份保证。

## Review Focus

- 初始已捏合、丢手后仍捏合：不得产生按钮动作或推子跳值。
- 第二只手入镜、顺序交换、接近与原手离开：不得抢占已有抓取；歧义取消。
- 拇指距离在阈值附近抖动、低帧率或旧帧：不得重复按下或沿用旧坐标。
- 面板变更、窗口缩放、隐藏页面和鼠标接管：取消而不是完成按钮，重新张开才可激活。
- 推子从任意抓取点开始并拖出边界：保留偏移，只钳制最终值；松开后保持。

### Task 1: 映射、捏合和控件核心

**Files:** 新建 `src/interaction/rect-mapping.ts`、`pinch.ts`、`single-hand-pointer.ts` 及测试，`src/controls/control-lab.ts` 及测试；扩展 `src/shared/contracts.ts`。

**Interfaces:** 生产 `SurfaceMapping`、`InteractionPointerEvent`、`ControlLayout`；`SingleHandPointer.process(frame, mapping)` 返回事件；`ControlLab.dispatch(event)` 返回只读状态。渲染与命中消费同一 `LAB_LAYOUT`。

- [x] 写失败测试：镜像、映射往返、边界外拖动、非法输入；初始闭合、滞回、防抖、丢手、旧帧、手顺序与歧义；按钮只在原区域松开、取消不触发、推子偏移和捕获。
- [x] 运行新测试，确认因尚无实现失败。
- [x] 最小实现上述模块；精确阈值、时间、布局共用常量。
- [x] 运行新测试并修复，再运行全套逻辑测试。

### Task 2: 实验台集成与交付

**Files:** 新建 `src/ui/InteractionLab.tsx`，修改 `CameraExperiment.tsx`、`App.tsx`、`styles.css` 与相关文档。

**Interfaces:** `CameraExperiment` 帧回调通过 ref 调用 `InteractionLab`；停止/隐藏/错误/null 清空手势捕获。面板调整或 ResizeObserver 取消已有指针。原生按钮/推子操作先取消手势。

- [x] 增加可用的实时控件面板、清晰状态及鼠标/键盘后备操作；原模拟骨架模式保留。
- [x] 使用模拟追踪帧通过真实回调验证按钮、推子、停止、重新激活；检查目标 Edge 桌面和窄屏布局。
- [x] 运行 `npm run check`；独立只读审查整轮代码并处理重要发现。最终文档／diff 检查随交付记录。
- [ ] 更新 `docs/PROGRESS.md` 的用户实测证据、本轮结果及 S2 真人验收步骤；README 只更新使用方法，生成本地阶段快照。
- [ ] 核对远端变化，在本地功能分支提交，不推送或合并。
