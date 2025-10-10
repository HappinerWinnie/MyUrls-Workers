# MyUrls - 功能强大的短链接服务

基于 Cloudflare Pages Functions 的现代化短链接服务，支持访问次数限制、密码保护、过期控制等高级功能。

> 基于 [CareyWang/MyUrls](https://github.com/CareyWang/MyUrls) 项目重构，增加了大量新功能和现代化界面。

## ✨ 核心功能

### 🔗 短链接生成
- 将长链接转换为简短易分享的链接
- 支持随机生成和自定义别名
- 智能URL验证和清理

### 🎯 访问次数限制（核心功能）
- 设置链接的最大访问次数
- 达到限制后自动失效
- 支持无限制访问模式
- **多维度限制**：总次数、同设备、同IP、同设备+IP组合限制

### 🔒 密码保护
- 为敏感链接设置访问密码
- 安全的密码哈希存储
- 优雅的密码验证界面

### ⏰ 过期控制
- 设置链接的有效期
- 自动失效过期链接
- 支持永不过期设置

### 📊 访问统计
- 实时统计链接访问次数
- 详细的访问历史记录
- 支持 Analytics Engine 数据收集
- 访问来源、设备类型统计

### 🔍 高级搜索
- 按短网址、源网址搜索
- 按标题和备注搜索
- 实时搜索结果

### 🛠️ 链接管理
- 编辑链接信息
- 批量删除操作
- 启用/禁用链接
- 数据导出功能

### 🔐 安全认证
- Cookie 基础的管理后台登录
- 密码从 CF 环境变量读取
- 会话管理和自动过期

### 🎨 现代化界面
- 基于 Tailwind CSS 的美观设计
- 完美适配桌面端和移动端
- 玻璃拟态效果
- 流畅的动画过渡

### 🌐 多种访问模式
- **重定向模式**：直接跳转（默认）
- **代理模式**：代理访问目标网站
- **密码模式**：需要密码验证
- **警告模式**：显示警告页面后跳转

### 🛡️ 高级风控系统（新功能）
- **设备指纹识别**：基于浏览器特征生成唯一设备ID
- **增强浏览器检测**：多维度检测浏览器、自动化工具、爬虫等
- **User-Agent过滤**：支持屏蔽浏览器或只允许特定UA访问
- **风险评分系统**：自动评估访问风险等级（0-100分）
- **异常检测**：检测短时间内大量访问、多设备同IP等异常模式
- **实时告警**：支持Telegram Bot告警，发现异常立即通知
- **封禁管理**：支持封禁/解封设备或IP，支持临时封禁
- **访问统计**：详细的访问记录和风控数据分析

## 技术栈

### 前端

- **Vue.js 2.6.11** - 渐进式 JavaScript 框架
- **Element UI 2.13.0** - 基于 Vue 的组件库
- **jQuery 3.6.0** - HTTP 客户端
- **Vue-clipboard2 0.3.1** - 剪贴板功能

### 后端

- **Cloudflare Pages** - 静态网站托管服务
- **Cloudflare Workers** - Serverless 计算平台
- **Cloudflare KV** - 键值存储数据库

## 部署方法 (Pages 和 Workers 任选一个)

 ### Cloudflare Pages
  
  1. Fork 本仓库
  2. 在 Cloudflare Pages 中创建新项目
  
  - 连接到您的 GitHub 仓库
  - 构建设置：
    - 构建命令：不需要
    - 输出目录：/
  
  3. 创建 KV 命名空间
  
  ![1738067979664](https://github.com/user-attachments/assets/ae96e948-0148-4bd6-bb19-4a0a53b6f229)
  ![e16e83362b97668fba0d9ec1e100585](https://github.com/user-attachments/assets/2f9ddec3-6ad0-4a11-a1b7-d2c5287ecfb6)

  - 在 Cloudflare 控制台创建 KV 命名空间，命名为 "`LINKS`"
  - 在 Pages 项目设置中绑定 KV：
    - 变量名：`LINKS`
    - KV 命名空间：选择刚创建的命名空间
  ![fe25d11f7ca80cd4ea987d069c81f3f](https://github.com/user-attachments/assets/b15b2b50-b8c5-4ce1-a789-184c022709a6)

  4. 部署后 请重新部署后 即可使用 Pages必须重重试部署 否则无法使用KV空间
 ![49f211b9addcf51a324e8ec6e0f0965](https://github.com/user-attachments/assets/63b64cfa-9d2d-4a64-a2f5-8f1403f6d0d6)

 ### Cloudflare Workers
  
  1. 打开 [_workers.js](https://github.com/kiko923/MyUrls-Workers/blob/main/_workers.js) 文件
  2. 复制全部内容
  3. 创建 Cloudflare Workers 点击 编辑代码 粘贴至代码框内 创建 KV 命名空间
  
  ![1738067979664](https://github.com/user-attachments/assets/f15ed931-5428-4e0c-97eb-0059f106f40f)
  ![e16e83362b97668fba0d9ec1e100585](https://github.com/user-attachments/assets/2f9ddec3-6ad0-4a11-a1b7-d2c5287ecfb6)
  - 在 Cloudflare 控制台创建 KV 命名空间，命名为 "`LINKS`"
  - 在 Workers 项目设置中绑定 KV：
    - 变量名：`LINKS`
    - KV 命名空间：选择刚创建的命名空间
  ![fe25d11f7ca80cd4ea987d069c81f3f](https://github.com/user-attachments/assets/b15b2b50-b8c5-4ce1-a789-184c022709a6)
  4. 完成部署后即可使用

## API 说明

### 创建短链接

- 端点：`POST /short`
- 请求体：
  ```json
  {
    "longUrl": "Base64编码的长链接",
    "shortKey": "可选的自定义后缀"
  }
  ```


