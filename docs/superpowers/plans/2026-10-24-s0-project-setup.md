# S0 Project Setup Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in the current session. The user has authorized S0 development; do not restart requirements approval. Steps use checkbox syntax for tracking.

**Goal:** 交付能安装、启动和检查的最小工程、真实共享类型与可检查的模拟追踪输入。

**Architecture:** React 仅维护低频的模拟样本界面。追踪数据与音频契约集中于共享类型，模拟数据生成独立于界面和未来音频实现。当前不连接摄像头、不安装模型、不创建音频引擎。

**Tech Stack:** Vite、React、严格 TypeScript、ESLint、Vitest、npm 单一锁文件；稳定版本以安装时 registry 元数据和实际检查为准。

**Spec:** `docs/PROJECT_PLAN.md` S0；`docs/INTERFACES.md`；`docs/ARCHITECTURE.md`。

## Global Constraints

- 最终目标仍包含手动桌面透视与双手音量／滤波；S0 不代表整个项目完成。
- 桌面 Edge 是验收目标；媒体本地处理，不请求麦克风。
- 不添加日期承诺、固定人员排期或未验证的性能成绩。
- 不改写共享 main，不引入后端、全局事件框架、Tone.js 或 3D 引擎。
- 本阶段只落实追踪与 A1 所需基础契约，滤波、手势状态机、透视留给对应阶段。
- 每阶段结束生成根目录 `handoff-YYYYMMDD-HHmm.md`，区分检查结果与实机未验证项；交接文件默认本地忽略，不夹带提交。

## Review Focus

1. 模拟输入必须显式标注，不能被误认为真实摄像头或识别性能。
2. 零只手输出空数组；新帧不得复用会污染旧帧的可变关键点。
3. 每只手恰好 21 点，原始坐标未镜像；视觉镜像只做一次。
4. 重置与切换手数后不残留旧样本，不显示虚假的追踪帧率或音频状态。
5. 从干净依赖安装可以构建；窄窗口和键盘可以操作样本界面。

前四项由数据测试／浏览器操作检查，第五项由 npm ci、检查命令和浏览器检查；摄像头和第二台设备复现仍需实测。

## File Map

- `package.json`、`package-lock.json`、`.node-version`、`.npmrc`：固定工具链和可复现安装。
- `tsconfig*.json`、`vite.config.ts`、`eslint.config.js`：类型、构建与检查。
- `src/shared/contracts.ts`：追踪及单曲音频基础契约，无运行时设备副作用。
- `src/tracking/mock-tracking.ts`：产生明确的离散模拟样本。
- `src/tracking/mock-tracking.test.ts`：空手、双手、关键点、时间和样本独立性。
- `src/App.tsx`、`src/ui/TrackingPreview.tsx`、`src/styles.css`：样本预览与状态。
- `src/main.tsx`、`index.html`：应用入口。
- 六份既有文档：仅同步实际状态、接口和运行命令；新增第三方许可说明。

### Task 1: Toolchain, shared contracts and mock input

**Files:** Create toolchain/configuration files, shared contracts, mock module and its test listed above. Update S0 claim in `docs/PROJECT_PLAN.md` before implementation.

**Interfaces:**
- Consumes: documented `Landmark`, `Size`, `HandObservation`, `TrackingFrame`, `AudioCommand`, `AudioState`, `AudioEngine` semantics.
- Produces: these types in `src/shared/contracts.ts`; `createMockTrackingFrame(frameId: number, sampledAtMs: number, handCount: 0 | 1 | 2): TrackingFrame`.

- [x] Configure exact compatible dependencies and npm scripts: `dev`, `typecheck`, `lint`, `test`, `test:watch`, `build`, `preview`, `check`.
- [x] Write tests before mock implementation: zero hands has empty array; one/two hands have distinct 21-point observations; every x/y is finite and in 0..1; timestamps and frame ID propagate; generating later frames does not mutate previous frames. These catch stale hands, wrong point counts and shared mutable fixtures.
- [x] Run `npm test` and observe failure because the module is missing.
- [x] Implement shared types and the smallest deterministic fixture generator. Samples use zero synthetic inference duration and explicitly documented synthetic timestamps; UI must not treat them as performance measurements.
- [x] Run `npm test`; expect all data tests to pass.
- [x] Run typecheck, lint and tests; inspect lockfile and staged diff before committing.

### Task 2: Runnable workbench and delivery

**Files:** Create the UI/entry files listed above; update README, AGENTS, architecture, interfaces, research and project plan; add third-party notices.

**Interfaces:**
- Consumes: Task 1 types and `createMockTrackingFrame`.
- Produces: a local React page for selecting zero/one/two hands, generating the next sample and resetting. Only explicit user actions change samples; no whole-tree per-frame loop.

- [x] Implement a focused responsive workbench: source marked simulated, skeleton preview, sample ID, hand count, and status of future camera/audio modules. No fake implemented DJ controls or permissions requests.
- [x] Browser-check select two hands → next frame → zero hands → reset; confirm no stale skeleton, no console errors, keyboard access and no horizontal overflow at narrow widths.
- [x] Run `npm ci`, then `npm run check` (typecheck + lint + tests + production build). Expect exit 0; verify dev and built preview respond successfully.
- [x] Update docs with actual commands, fixed versions, module boundaries and verification limits. Keep S0 “待验证” until the other developer has reproduced the same commit.
- [x] Record the requirement to generate a handoff after each phase in AGENTS and the plan; check relative links and `git diff --check`.
- [x] Review the whole branch once, fix important findings, and commit verified files explicitly.
- [x] Generate the local handoff with current branch/commit, work completed, exact checks, remaining second-device verification, next S1 task and environment notes.

## Acceptance boundary

S0 code delivery may be ready while collaborative acceptance remains pending. Do not mark two-person reproduction, camera compatibility, tracking latency or audio quality complete based on local code checks.
