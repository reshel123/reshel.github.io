# DeepSeek 聊天室功能

这是一个基于LeanCloud实时通讯服务的网页聊天应用。用户可以创建或加入房间进行文本和文件的实时交流。

## 功能特点

- 房间聊天：用户可以通过4位数房间码加入相同房间
- 文本消息：发送和接收实时文本消息
- 文件传输：支持文件上传和下载
- 离线模式：在无法连接LeanCloud服务器时自动切换到离线模式
- 响应式设计：适配各种屏幕尺寸

## 设置步骤

### 1. 获取LeanCloud账号和应用

1. 访问 [LeanCloud官网](https://www.leancloud.cn/) 注册账号
2. 创建一个新应用（国内版）
3. 在应用设置中开启实时通信服务
4. 记录以下信息：
   - AppID
   - AppKey
   - 服务器地址（国内版需要）

### 2. 配置应用

1. 编辑 `leancloud-config.js` 文件：
```javascript
// LeanCloud 应用配置
const LC_CONFIG = {
    appId: '替换为您的AppID',
    appKey: '替换为您的AppKey',
    serverURL: '替换为您的服务器地址' // 例如 https://your-app.leancloud.cn
};
```

### 3. 启动应用

直接在浏览器中打开 `room-chat.html` 文件即可使用。

## 离线模式

如果无法连接到LeanCloud服务器，应用会自动切换到"离线模式"，此模式下：
- 可以发送和接收模拟消息
- 文件传输功能不可用
- 消息不会发送到其他用户

## 技术架构

- 前端：纯HTML, CSS, JavaScript
- 实时通信：LeanCloud实时通信SDK
- 文件存储：LeanCloud文件存储服务

## 目录结构

```
/
├── room-chat.html     # 主HTML文件
├── style.css          # 样式表
├── room-chat-cn.js    # 主要功能实现
├── leancloud-config.js # LeanCloud配置
└── lib/               # 本地SDK备份
    ├── av.min.js
    ├── realtime.browser.min.js
    └── typed-messages.min.js
```

## 问题排查

1. **无法连接到LeanCloud服务器**
   - 检查网络连接
   - 确认配置信息是否正确
   - 查看浏览器控制台是否有错误信息

2. **消息发送失败**
   - 检查您是否有权限向该对话发送消息
   - 确认网络连接正常
   - 尝试刷新页面后重试

3. **文件上传失败**
   - 检查文件大小是否超过限制（一般为100MB）
   - 确认网络连接稳定
   - 尝试使用较小的文件测试

## 隐私声明

本应用使用LeanCloud存储和传输用户数据。请勿在聊天中分享敏感个人信息。所有聊天记录和文件将存储在LeanCloud服务器上。 