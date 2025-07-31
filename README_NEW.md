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

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/kiko923/MyUrls-Workers.git
cd MyUrls-Workers
```

### 2. 创建 KV 命名空间
```bash
# 创建生产环境 KV 命名空间
wrangler kv:namespace create "LINKS"

# 创建开发环境 KV 命名空间（可选）
wrangler kv:namespace create "LINKS" --preview
```

### 3. 配置环境变量
在 Cloudflare Pages 控制台中设置以下环境变量：

- `ADMIN_PASSWORD`: 管理员密码
- `REQUIRE_AUTH`: 是否需要认证（true/false）

### 4. 绑定 KV 命名空间
在 Pages 项目设置中绑定 KV 命名空间：
- 变量名称: `LINKS`
- KV 命名空间: 选择第2步创建的命名空间

### 5. 部署
将代码推送到 GitHub，然后在 Cloudflare Pages 中连接仓库并部署。

## 📁 项目结构

```
MyUrls-Workers/
├── functions/                 # Cloudflare Pages Functions
│   ├── api/                  # API 端点
│   │   ├── auth/            # 认证相关 API
│   │   ├── links/           # 链接管理 API
│   │   ├── stats/           # 统计 API
│   │   └── verify/          # 密码验证 API
│   ├── utils/               # 工具函数
│   │   ├── auth.js         # 认证工具
│   │   ├── crypto.js       # 加密工具
│   │   └── response.js     # 响应工具
│   ├── [shortKey].js       # 短链接访问处理
│   ├── admin.js            # 管理后台
│   └── short.js            # 兼容旧版本 API
├── docs/                    # 文档
├── index.html              # 主页面
├── wrangler.toml           # Cloudflare 配置
└── README.md               # 项目说明
```

## 🎯 使用说明

### 创建短链接
1. 访问部署后的域名
2. 输入要缩短的长链接
3. 可选择设置自定义别名、访问次数限制等高级选项
4. 点击"生成短链接"按钮

### 管理后台
1. 访问 `/admin` 路径
2. 输入管理员密码登录
3. 可以查看所有链接、统计数据
4. 支持编辑、删除、批量操作

### API 使用

#### 创建短链接
```bash
curl -X POST https://your-domain.com/api/links \
  -H "Content-Type: application/json" \
  -d '{
    "longUrl": "https://example.com/very/long/url",
    "shortKey": "custom-alias",
    "title": "示例链接",
    "maxVisits": 100,
    "expiryDays": 30
  }'
```

#### 获取链接统计
```bash
curl -X GET https://your-domain.com/api/stats/abc123 \
  -H "Authorization: Bearer your-session-token"
```

## 🔧 技术栈

- **前端**: Vue 3 + Tailwind CSS
- **后端**: Cloudflare Pages Functions
- **存储**: Cloudflare KV
- **分析**: Cloudflare Analytics Engine（可选）
- **认证**: Cookie-based Sessions

## 📝 更新日志

### v2.0.0 (2024-01-31)
- 🎯 新增访问次数限制功能（核心功能）
- 🔒 新增密码保护功能
- ⏰ 新增过期控制功能
- 📊 完善访问统计系统
- 🎨 全新的现代化界面设计
- 📱 优化移动端体验
- 🔐 新增管理后台认证系统
- 🛠️ 新增批量管理功能
- 🔍 新增高级搜索功能
- 🌐 支持多种访问模式

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License

## 🙏 致谢

- 感谢 [CareyWang/MyUrls](https://github.com/CareyWang/MyUrls) 提供的基础项目
- 感谢 Cloudflare 提供的优秀服务
