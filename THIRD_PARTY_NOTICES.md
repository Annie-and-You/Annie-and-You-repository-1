# 第三方依赖与声明

记录日期：2026-10-24。项目原创内容尚未选择许可证。以下依据实际安装包的 package.json 与 LICENSE 核对；依赖通过 npm 安装，未复制参考 DJ 项目源码。

## 运行时依赖

| 包 | 固定版本 | 来源 | 许可 |
| --- | --- | --- | --- |
| React | 19.3.1 | [官方仓库](https://github.com/facebook/react) | MIT |
| React DOM | 19.3.1 | [官方仓库](https://github.com/facebook/react) | MIT |
| Scheduler（间接依赖） | 0.28.0 | [官方仓库](https://github.com/facebook/react) | MIT |
| MediaPipe Tasks Vision（JS／WASM） | 1.1.1 | [官方仓库](https://github.com/google-ai-edge/mediapipe)、[npm 包](https://www.npmjs.com/package/@mediapipe/tasks-vision/v/1.1.1) | Apache-2.0 |
| Hand Landmarker 模型 | hand_landmarker / float16 / 1 | [固定模型](https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task)、[模型卡](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20Hand%20Tracking%20%28Lite_Full%29%20with%20Fairness%20Oct%202021.pdf) | Apache-2.0（模型卡） |

完整 MIT 版权与许可声明保存在 [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt)，Vite 会将它复制到构建目录。上述包未经本项目修改；包版本与传递依赖摘要由 `package-lock.json` 固定。

MediaPipe 与模型未经修改。模型 SHA-256 为 `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`，由准备脚本校验。Apache 许可全文与上游附带声明保存在 [public/licenses/mediapipe-LICENSE.txt](public/licenses/mediapipe-LICENSE.txt)，随构建复制；安装包未附独立 NOTICE，保留发布文件内原有声明。Worker 代码为本项目按 API 编写，没有复制官方示例实现。

## 开发工具

以下为开发依赖，不随页面作为运行时依赖分发。

| 包 | 版本 | 包声明许可 |
| --- | --- | --- |
| Vite | 8.3.5 | MIT |
| @vitejs/plugin-react | 6.1.2 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| Vitest | 5.0.5 | MIT |
| ESLint | 10.13.0 | MIT |
| @eslint/js | 10.0.1 | MIT |
| typescript-eslint | 8.72.0 | MIT |
| eslint-plugin-react-hooks | 7.1.1 | MIT |
| eslint-plugin-react-refresh | 0.5.7 | MIT |
| globals | 17.13.0 | MIT |
| @types/node | 24.10.0 | MIT |
| @types/react | 19.3.0 | MIT |
| @types/react-dom | 19.3.0 | MIT |

这些工具和类型包的具体来源、许可证、NOTICE 与传递依赖文件保留在 npm 安装包内。固定版本可在 npm registry 查询，安装完整性由锁文件的 integrity 字段校验；不把所有传递依赖笼统归为同一种许可。

未引入 Tone.js、Three.js 或外部图标／字体／音乐资源。模拟手形坐标、SVG 展示代码及 favicon 为项目自建示意，不是采集到的生物特征数据。
