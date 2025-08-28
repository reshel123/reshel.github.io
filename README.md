# 🌟 多功能网页：AI 聊天 · AI 绘画 · 软件下载 · 小游戏 · 秘密入口

一个纯前端、零后端依赖的多功能网站。支持直接部署到 GitHub Pages，提供现代玻璃拟态界面、细腻动画与良好移动端体验。

- 在线演示：`https://289872.xyz`
- 适用场景：个人主页 / 作品集 / 工具导航 / 轻量内容站

---

## ✨ 功能一览

- 🤖 AI 聊天（`ai/index.html`）
  - 多模型多标签会话（内置模型列表，可一键新增标签切换模型）
  - 调用第三方推理接口（默认示例为 ChatAnywhere，支持替换为任意服务商）
  - 限流自动重试（429）、错误友好提示
  - 轻量动效：粒子背景、鼠标跟随、毛玻璃界面

- 🎨 AI 绘画（`ai/painting.html`）
  - 文本生成图片：支持多尺寸、1–4 张批量生成
  - 图片网格展示：点击卡片进入模态大图预览（ESC/点击遮罩关闭）
  - 一键“静默下载”（无弹窗）与“删除”，预览内支持“下载 / 分享（复制链接）”
  - 本地存储历史记录；失败降级为新标签打开以便手动保存

- 📦 软件下载（`downloads/index.html`）
  - 分类浏览：Windows / Android / 媒体资源
  - 外链直下；媒体可在新标签页预览

- 🎮 小游戏（`games/*.html`）
  - 蛇、俄罗斯方块、Flappy、华容道、记忆牌、打砖块
  - 键盘/触摸双端操作

- 🔒 秘密入口（`secret/index.html`）
  - 右上角入口、密码校验、外链视频播放，数秒后自动返回主页

- 🌤️ 天气与 🎵 音乐（主页 `index.html`）
  - 和风天气 + 定位缓存；8 首随机音乐与加载页音乐

---

## 🔗 外部服务 / API 列表

- AI 聊天：ChatAnywhere API（`https://api.chatanywhere.com.cn`）
- AI 绘画：智谱 AI（ZhipuAI）BigModel 图像生成接口（`https://open.bigmodel.cn/api/paas/v4/images/generations`）
- 天气：和风天气（QWeather / HeWeather）
- 位置：浏览器 Geolocation API（必要时可配合 Nominatim / BigDataCloud 反查城市名）
- 音乐：网易云音乐外链（客户端直连播放）
- 下载资源：各条目所指向的第三方直链（图片/视频/压缩包等）

> 以上服务均为前端直接请求。生产使用建议将私钥放在自己的后端代理，避免在浏览器暴露。

---

## ⚡ 快速配置（代码位置）

- AI 聊天（ChatAnywhere 示例）— 文件：`ai/index.html`
```javascript
// 搜索并替换：API_KEY 与请求端点
const API_KEY = '你的ChatAnywhere密钥';

async function fetchAIResponse(prompt, model) {
  const response = await fetch('https://api.chatanywhere.com.cn/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: '你是一个有用的AI助手，请用中文回答。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1024
    })
  });
  // ...错误处理略
}
```

- AI 绘画（ZhipuAI BigModel 示例）— 文件：`ai/painting.html`
```javascript
// 配置（AI_PAINTING_CONFIG 与 getZhipuAccessToken）
const AI_PAINTING_CONFIG = {
  apiKey: '你的ZhipuAI_API_Key',
  endpoint: 'https://open.bigmodel.cn/api/paas/v4/images/generations'
};

async function getZhipuAccessToken() {
  return AI_PAINTING_CONFIG.apiKey; // 示例：直接返回（生产建议走后端代理）
}

// 调用
const url = AI_PAINTING_CONFIG.endpoint;
const apiKey = await getZhipuAccessToken();
const authorizationHeader = `Bearer ${apiKey}`;
const resp = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': authorizationHeader
  },
  body: JSON.stringify({
    prompt: userPrompt,
    size: selectedSize,
    n: imageCount
    // ...按服务商要求补充参数
  })
});
```

- 安全建议（强烈推荐）
  - 千万不要在公开仓库与生产前端中暴露完整私钥；
  - 使用自有后端代理：校验来源、注入密钥、设置调用配额与频次；
  - 若必须前端直连，务必使用“受限 Key”（只允许指定域名与最低权限）。

---

## 🧱 目录结构

```
├── index.html                 # 主页（导航/天气/音乐/动效）
├── 404.html                   # GitHub Pages 兜底 + 路由兜转
├── CNAME                      # 自定义域名（可选）
├── assets/
│   ├── css/style.css          # 共享样式
│   ├── js/image-optimizer.js  # 图片优化/懒加载辅助
│   └── img/…                  # 背景与站点图片
├── ai/
│   ├── index.html             # AI 聊天
│   └── painting.html          # AI 绘画（对接 ZhipuAI BigModel）
├── downloads/index.html       # 软件下载
├── games/
│   ├── index.html             # 游戏入口
│   ├── snake.html tetris.html flappy.html puzzle.html memory.html breakout.html
└── secret/index.html          # 秘密入口页
```

---

## ▶️ 本地运行

本项目为纯静态站点，建议使用本地静态服务器（避免 `file://` 的跨域限制）：

- VS Code：右键 `index.html` → Open with Live Server
- 或使用任意工具（`http-server`、`serve` 等）
- 访问示例：`http://127.0.0.1:5500/`（以实际端口为准）

> 本地直开若出现 404，请使用带 `.html` 的路径：如 `/ai/painting.html`。

---

## ☁️ GitHub Pages 部署

1. 代码推送到 GitHub（分支 `main` 或 `master`）。
2. 仓库 Settings → Pages：选择 `Deploy from a branch`；分支选 `main` 与 `/ (root)`。
3. 等待几分钟访问 `https://<username>.github.io/<repo>/`。
4. 自定义域名：将根目录 `CNAME` 改为你的域名，并在 DNS 添加 CNAME 记录指向 `username.github.io`。

---

## 🧭 使用指南（要点）

### AI 聊天（`/ai/`）
1. 默认创建一个 GPT-4o 标签，可通过“+”添加不同模型。
2. 输入消息后点击“发送”或回车。
3. 若遇到 429/限流，将提示切换模型或自动重试。

### AI 绘画（`/ai/painting.html`）
1. 输入提示词、选择尺寸与数量，点击“生成”。
2. 生成的图片以卡片显示：点击图片进入大图预览。
3. 图片卡片下方提供“下载 / 删除”；预览框底部提供“下载 / 分享（复制链接）”。

### 软件下载（`/downloads/`）
- 切换分类、点击下载按钮直下；媒体资源支持浏览器原生预览。

### 小游戏（`/games/`）
- 进入入口页选择游戏，根据页面提示进行键盘/触摸操作。

### 秘密入口（`/secret/`）
- 右上角进入，输入暗号后观看外链视频，数秒后自动返回主页。

---

## ⌨️ 快捷键 & 可用性

- 预览模态框：`ESC` 关闭；点击遮罩关闭
- 音乐：空格 播放/暂停；→ 下一曲
- 按钮、链接具备清晰的焦点/悬停状态

---

## 🚀 性能与图片优化

- 懒加载与预加载、错误占位
- 本地存储 AI 绘画历史（仅保存在用户浏览器）
- `assets/js/image-optimizer.js` 统一处理图片优化（可扩展）

---

## 🧰 常见问题（FAQ）

- Q: 访问 `/ai/painting` 404？
  - A: GitHub Pages 为静态托管，建议使用 `/ai/painting.html` 或从首页导航进入；也可依赖 `404.html` 的前端修正兜转。

- Q: 下载弹窗打断？
  - A: 已实现“静默下载”，不会弹窗；若 `fetch` 因跨域失败，将降级为新标签打开图片以便手动另存。

- Q: 如何接入自己的服务商？
  - A: 在对应页面替换 `fetch` 端点与鉴权头；逻辑已与 UI 分离，替换快捷。

---

## 📝 版本记录（要点）

- v2.3.0（当前）
  - AI 绘画：模态预览、静默下载、卡片“下载/删除”、预览“下载/分享”
  - 交互动画与样式细节优化
- v2.2.0
  - 新增 AI 绘画生成器、图片交互与性能优化、本地存储
- v2.1.0
  - 智能加载、天气/音乐升级、软件下载更新
- v2.0.0
  - 新增 6 款小游戏、聊天界面优化、隐藏功能完善
- v1.0.0
  - 初始版本：AI 聊天 + 软件下载 + 响应式 + 多语言

---

## 🤝 参与共建

欢迎通过 Issue / PR 提交改进建议与功能实现。

## 📄 许可证

本项目采用 MIT 许可证。

## 📬 联系

问题与建议请联系：`1905680441@qq.com`

---

© 2025 黄金树 · AI 助手 & 软件下载中心 & AI 绘画 
