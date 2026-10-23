# 技术与开源资源研究

资料核查日期：2026-10-23 至 2026-10-24。已查阅下列官方资料、仓库说明和许可文件，并复核引用链接；**未安装运行这些参考项目，也未测试本项目摄像头、音质或交互性能**。仓库 README 的功能描述不等于本项目已验收。

## 1. 当前结论

采用“小型应用＋成熟库＋许可明确的参考模块”：MediaPipe 追踪，React／DOM 控件，浏览器原生音频。自己实现项目特有的捏合交互、坐标映射与控件占用，不从零训练手部模型或制作复杂 DSP。

未确认一个成熟、许可明确且完整覆盖“笔记本摄像头＋桌面叠加＋捏合拖动＋本地歌曲＋双手并行”的即用成品。最相似的几个项目较新，适合作为试跑对象和实现参考，不能包装成已经验证的成熟底座。

最终必须实现手动桌面透视对齐和双手操作。优先用四角映射实现桌面效果，3D 引擎按后续视觉需要引入；单手矩形面板仅用于降低初次实验成本。

## 2. 技术库与官方依据

| 方案与来源 | 已核实能力／许可 | 选型判断 |
| --- | --- | --- |
| [MediaPipe Hand Landmarker Web 指南](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker/web_js) | 输出每手 21 个图像／world 关键点；`VIDEO` 模式；同步检测调用 | 首选追踪接口。自然控件操作仍需自建交互状态机 |
| [MediaPipe 代码许可](https://github.com/google-ai-edge/mediapipe/blob/master/LICENSE) | Apache-2.0 | 引入包和示例时保留许可及要求的声明 |
| [官方 Hand Tracking Lite/Full 模型卡](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf) | 模型卡列出 Apache-2.0，并说明遮挡、模糊及深度估计等限制 | 模型许可与代码许可分别登记；落地时固定实际采用的模型来源、版本／摘要，不把此卡泛化为任意第三方模型的许可 |
| [MediaPipe Web 配置](https://developers.google.com/edge/mediapipe/solutions/setup_web) | 官方列 Chrome／Safari；提供 CPU／GPU delegate | 用户选择 Edge，必须做实际兼容性验证，不能把 Chromium 同源当验收证明 |
| [官方 Hand Landmarker Worker 示例](https://github.com/google-ai-edge/mediapipe-samples-web/blob/main/src/workers/hand-landmarker.worker.ts) | 源码带 Apache-2.0 声明，接收 bitmap，执行检测后释放资源，支持 CPU／GPU 配置 | 参考其 Worker 封装；帧传输、GPU 路径和性能仍需本机验证 |
| [TensorFlow.js hand-pose-detection](https://github.com/tensorflow/tfjs-models/tree/master/hand-pose-detection) | 官方接口提供 MediaPipe Hands 模型的不同 runtime | 可作为后端比较候选，换接口不代表换成一个必然更准的独立模型；当前不增加第二套追踪依赖 |
| [Web Audio 媒体源接口](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/createMediaElementSource) | 可把 `<audio>` 接入音频处理图；浏览器内建 API | 当前单曲音量／滤波首选，减少播放状态和整曲缓存管理成本 |
| [Tone.js](https://tonejs.github.io/)／[MIT 许可](https://github.com/Tonejs/Tone.js/blob/dev/LICENSE.md) | 音乐调度、合成器、效果器和采样播放 | 有节拍同步或复杂音乐需求时再引入；不是当前 MVP 的必要依赖 |
| [Three.js](https://threejs.org/)／[MIT 许可](https://github.com/mrdoob/three.js/blob/dev/LICENSE) | 通用 3D 渲染 | 可用于后续模型、材质和场景；不替代手势识别和桌面校准 |
| [React Three Fiber](https://r3f.docs.pmnd.rs/getting-started/introduction)／[包许可与依赖](https://github.com/pmndrs/react-three-fiber/blob/master/packages/fiber/package.json) | Three.js 的 React 渲染层，MIT；需匹配 React 主版本 | 已有 React 应用增加 3D 时优先评估稳定配对版本，不盲目使用 alpha |
| [perspective-transform](https://github.com/jlouthan/perspective-transform)／[MIT 许可](https://github.com/jlouthan/perspective-transform/blob/master/LICENSE) | 四角正反投影及矩阵，无运行时依赖 | 桌面对齐优先候选；代码较旧，需 TypeScript 适配、数值及退化输入测试 |

Vite／React／TypeScript 作为基础工具链，创建工程时固定相容的稳定版本与锁文件。[Vite 官方指南](https://vite.dev/guide/)列出 Node 版本要求；不要让两人各自安装不同的浮动依赖后再合并。当前未创建依赖清单，也未宣称某一包组合已构建通过。

## 3. 完整项目与接近效果的参考

| 项目 | 仓库描述及可复用部分 | 许可证证据 | 适配判断 |
| --- | --- | --- | --- |
| [DJ Hands](https://github.com/yusif-projects/dj-hands) | 浏览器摄像头音乐工具，MediaPipe、双手分工、骨架叠层、Tone.js 合成和弦；可参考摄像头与追踪模块 | [Apache-2.0](https://github.com/yusif-projects/dj-hands/blob/main/LICENSE) | 手势模块适配成本中；没有本项目所需的本地歌曲与通用捏合拖动，不能直接当成品 |
| [MixCN](https://github.com/melromyeah/MixCN) | 浏览器本地歌曲、双 deck、EQ、crossfader、波形、cue／loop 和 worklet；抽查过音频引擎及有符号速率处理 | [Apache-2.0](https://github.com/melromyeah/MixCN/blob/main/LICENSE) | 双音轨／搓碟阶段的重要候选；整个 Next.js DJ 工程超出当前单曲需求，未验证专业搓碟音质 |
| [Scratch Deck](https://github.com/pixelputra-cloud/dj-scratch-deck)／[演示](https://pixelputra-cloud.github.io/dj-scratch-deck/) | 摄像头背景、手势唱盘、本地音频、鼠标后备、AudioWorklet，整体构想最接近 | 核查时未找到项目 LICENSE，仓库元数据无许可证 | 学习效果和交互思路；许可明确前不默认复制修改后发布。README 自称 MVP，手感尚需验证 |
| [AudioMass](https://github.com/pkalogiros/AudioMass)／[演示](https://audiomass.co/) | 完整浏览器音频编辑器；可参考本地文件、波形与效果处理 | [原创代码 MIT](https://github.com/pkalogiros/AudioMass/blob/production/LICENSE)；[第三方声明](https://github.com/pkalogiros/AudioMass/blob/production/THIRD_PARTY_NOTICES.md)另列 WaveSurfer、LAME 等许可 | 更有积累，但不是 DJ deck；整站改造成本较高，只按需要研究模块 |
| [SoundManager2 Turntable](https://github.com/scottschiller/SoundManager2/tree/master/demo/turntable) | 唱盘、唱针与页面分层演示 | [BSD-3-Clause](https://github.com/scottschiller/SoundManager2/blob/master/license.txt)；演示媒体需另外核对权利 | 历史 UI 参考，不作为现代音频底座；[Wheels Of Steel](https://wheelsofsteel.net/) 的历史 scratch 能力依赖 Flash 路径 |
| [Mixxx](https://github.com/mixxxdj/mixxx) | 成熟的 Windows／macOS／Linux 桌面 DJ 应用 | [GPLv2](https://github.com/mixxxdj/mixxx/blob/main/LICENSE) | 参考专业交互和行为；不是浏览器组件，移植引擎的成本不适合当前阶段 |

另两个容易误选的项目：

- [MIXI](https://github.com/fabriziosalmi/mixi) 功能丰富，但实际 [LICENSE](https://github.com/fabriziosalmi/mixi/blob/main/LICENSE) 为 PolyForm Noncommercial 1.0.0，不能描述为没有商业用途限制的宽松许可底座；工程范围也明显更大。
- [DJ_CV](https://github.com/tcheol/dj_CV) 是 Python／OpenCV／pygame 桌面项目，不是网站；核查时未找到项目许可证，不作为直接复用底座。

选择原则：先试跑目标模块和必要场景，再决定是否复用。不能把两个完整应用生硬合并，也不能仅凭演示视频、星数或 README 宣传承诺稳定性。

## 4. 模型、图标与动画资源

- [Lucide 图标](https://lucide.dev/icons/)适合播放、暂停、音量和摄像头按钮。[许可页](https://lucide.dev/license)为 ISC，部分继承 Feather 图标保留 MIT 声明。
- [Poly Haven](https://polyhaven.com/models)提供模型、材质与 HDRI；[资产许可](https://polyhaven.com/license)为 CC0。可用于未来环境和表面材质，本次未核验到可直接套用的完整 DJ 控制台模型。
- 初期按压、抓取、高亮和推子反馈用 CSS 动画即可。后续引入模型及动画时，按具体资产检查许可、来源和浏览器性能，不把网站通用条款等同于所有资源的许可。

实际引入时登记：项目／资源名称、原始 URL、固定版本或提交、模型／资产摘要、许可证、保留的声明、修改说明和验证结果。需要时新增第三方声明文件；本轮没有导入第三方源码、模型或素材。

## 5. 几何、交互与浏览器限制

- **机位：** 只知道俯角不能推断视野。相机高度、镜头视场、桌面距离、分辨率、裁切和手活动高度都影响可见范围；以实际双手轨迹入镜为准。
- **深度：** MediaPipe 的相对 z 和手中心 world 坐标不是相机到桌面的绝对定位，不能直接当触桌检测。遮挡、侧手和模糊会影响指尖与捏合识别。
- **透视：** [OpenCV 官方说明](https://docs.opencv.org/4.13.0/d9/dab/tutorial_homography.html)解释平面 homography。四角校准适用于面板平面；抬高手指仍可能产生视差，需要限制到舒适、清楚可见的操作区域。
- **身份：** [当前结果类型](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/tasks/web/vision/hand_landmarker/hand_landmarker_result.d.ts)没有本项目可以直接使用的永久 hand ID。左右分类和结果顺序不能替代双手关联。
- **音频启用：** [浏览器自动播放规则](https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay)要求处理用户激活与播放失败，摄像头识别不是可信点击事件。
- **摄像头权限：** [`getUserMedia` 官方文档](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)说明安全上下文与权限要求；本地通过 localhost 提供页面，并处理拒绝、占用和无设备情况。
- **后续 DJ 能力：** 普通播放速率变化、保音高变速和专业搓碟不是同一问题。不能因为参考项目实现倒放，就宣称已具备专业时间伸缩或对拍效果。

## 6. 实验与结论维护

当前待验证：两台内置摄像头的真实覆盖和清晰度，Edge Worker／GPU 兼容性，双手追踪性能，捏合误触与抖动，透视远端控件可用性，双手身份关联，音频实际延迟与连续使用舒适度。

验收目标和操作次数只在[项目计划](PROJECT_PLAN.md)维护。每次实验新增简短记录：条件、配置、次数、实测指标、失败场景、结论、下一步；没有执行的项目写“未验证”，不填估计成绩。

采用或替换依赖、模型、资产时复核此文档对应条目。外部 URL、许可证或包行为可能变化；后续复用以实际引入版本的证据为准。
