# Nori Desktop · 官网

基于 Nori.Web 的信息之海、意向残余与重新相遇主题，为 Nori Desktop 社区项目制作的响应式静态介绍站。视觉参考本地 Nori.Web 的深海毛玻璃主题。

## 运行

需要 Node.js 22 或更新版本，无需安装依赖。

```sh
npm run dev
```

访问 http://127.0.0.1:4173。也可以直接打开 `index.html` 浏览主要内容；完整交互建议通过本地服务器查看。

```sh
npm test
npm run build
npm run preview
```

`dist/` 可直接部署到静态托管服务，所有资源使用相对路径，支持子目录部署。设置环境变量 `PORT` 可更改预览端口。

## 内容与入口

- 世界观参考：`Nori_Web_ARG_Analysis_Report.md`。首页以重新认识 Nori 为主线，不公开复述 ARG 终局。
- 功能和运行要求：来自相邻 `Nori-Desktop-Pet/README.md` 与发布工作流；下载链接使用其实际 Git remote：`https://github.com/MF-Dust/Nori.Desktop`。
- 三个平台按钮直接下载 GitHub 发布包，HTML 内置已核实的 `v2.0.2-Kei` 附件直链，无 JavaScript 也能下载。页面加载时请求一次 GitHub `/releases/latest` API，按平台归档后缀匹配附件并更新为最新正式版；不会匹配 `.sha256` 校验文件。查询失败、限流或缺少平台附件时保留原直链，并提供「查看全部版本」入口。发布包仍需 .NET Runtime 10，不是独立安装器。
- 相遇预览是标注清楚的预设台词，不是 Live2D 实时渲染、真实应用截图或 AI 聊天；不会连接模型服务。
- 桌宠项目是社区非官方、非商业项目。云端模型/语音服务可能收费，并会收到相应请求。

## 交互与动效

- 保持单页结构：点击导航时使用原生 View Transitions 轻淡入淡出，浮动导航保持原位；不支持时使用原生平滑锚点滚动。
- 当前栏目随滚动高亮，导航底边显示阅读进度，阅读后出现返回顶部入口。锚点、前进/后退与键盘焦点保持可用。
- 首屏分层入场，区块进入视口时轻轻浮现；内容不会依赖动画才能显示。
- 三个预设场景同步切换对话、便签、编号与背景光色，连续点击始终以最后一次选择为准。
- 移动端菜单淡入收起，关闭时移出键盘导航；FAQ 保留原生 details，并在支持的浏览器中平滑展开/收起。
- 遵循系统“减少动态效果”设置，包括运行中切换偏好；动效本身不引入依赖或额外网络请求。

## 结构

`index.html` 页面、`styles.css` 响应式样式、`app.js` 导航和预设场景交互、`assets/` 本地素材、`scripts/` 原生 Node 开发服务器和构建脚本。

## 素材说明

- `assets/nori-reunion.webp`：从 `Nori.Web/public/datasea/cg-touch-her.webp` 裁切、缩放并转码，保留透明背景。
- `assets/nori-pet.webp`：来自 `Nori-Desktop-Pet/app/desktop/src/assets/images/live2D/Nori.webp`。
- `assets/logo.png`：来自 `Nori-Desktop-Pet/app/desktop/src/assets/images/logo.png`，缩放优化。
- Nunito 字体来自 Nori.Web 中已安装的 Fontsource 包；许可证保留在 `assets/OFL.txt`。
- 角色、原作插画与模型相关权利归原权利人所有，桌宠源代码的 GPLv3 不代表上述素材自动适用同一许可。发布前应核实对应素材的使用授权。

## 浏览器检查（可选）

`tests/browser.mjs` 自动构建并启动独立临时服务器，检查桌面/平板/手机宽度、菜单键盘操作、预设台词、FAQ、资源错误与子目录部署；另覆盖正常动效、导航高亮、历史回退、连续切换、原生降级和运行中减少动态效果。另验证三个平台按钮能触发下载；GitHub API 和下载内容使用测试响应，不下载真实大文件。最新附件匹配、缺失平台、非可信地址与离线回退由 `tests/site.test.mjs` 验证。截图保存至 `.verification/`。

若已安装 Playwright：

```sh
npm run test:browser
```

或用环境变量 `PLAYWRIGHT_MODULE` 指向现有 Playwright 的 `index.mjs` 绝对路径。需要可用的 Chromium 浏览器（可通过 Playwright 安装）。普通构建与静态测试不依赖 Playwright。
