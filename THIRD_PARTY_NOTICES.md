# 第三方依赖与声明

记录日期：2026-10-24。项目原创内容尚未选择许可证。以下依据实际安装包的 package.json 与 LICENSE 核对；依赖通过 npm 安装，未复制参考 DJ 项目源码。

## 运行时依赖

| 包 | 固定版本 | 来源 | 许可 |
| --- | --- | --- | --- |
| React | 19.3.1 | [官方仓库](https://github.com/facebook/react) | MIT |
| React DOM | 19.3.1 | [官方仓库](https://github.com/facebook/react) | MIT |
| Scheduler（间接依赖） | 0.28.0 | [官方仓库](https://github.com/facebook/react) | MIT |

完整 MIT 版权与许可声明保存在 [public/THIRD_PARTY_NOTICES.txt](public/THIRD_PARTY_NOTICES.txt)，Vite 会将它复制到构建目录。上述包未经本项目修改；包版本与传递依赖摘要由 `package-lock.json` 固定。

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

S0 没有安装 MediaPipe、模型、Tone.js、Three.js 或外部图标／字体／音乐资源；后续引入时单独登记版本、来源、许可与必要声明。当前手形坐标和 SVG 展示代码为项目自建示意，不是采集到的生物特征数据。
