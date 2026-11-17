# multiwork 产品官网

[线上官网](https://xuilen.github.io/multiwork/) 使用静态 HTML、CSS 和原生 JavaScript。打开 `index.html` 即可预览。桌面版采用双栏首屏，小屏依次展示产品介绍和用量面板。

## 用量示例

`main.js` 包含每个 Agent 的示例回复数据。输入、输出和总量由相同的回复记录计算。图表使用固定刻度，支持的示例展示回复时的额度快照，缺失数据以文字和破折号显示。官网无需连接账号或读取本地客户端。

## 维护与发布

- 在 `index.html` 中维护中文内容、英文翻译和下载链接。`i18n.js` 管理语言及配色偏好。
- 在仓库根目录运行 `node --test meldwork-landing/test/landing.test.cjs`。测试依赖 frontend 中安装的 jsdom。
- 将改动推送到 main 后，GitHub Pages 工作流会发布页面、实机截图、图标和许可证文件。下载包由 GitHub Releases 提供。
