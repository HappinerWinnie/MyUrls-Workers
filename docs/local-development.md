# 本地开发指南

本指南将帮助您在本地环境中运行和开发 MyUrls 短链接服务。

## 前置要求

- Node.js 16.0.0 或更高版本
- npm 或 yarn
- Cloudflare 账户（用于 KV 存储）

## 快速开始

### 1. 克隆项目
```bash
git clone https://github.com/kiko923/MyUrls-Workers.git
cd MyUrls-Workers
```

### 2. 自动设置（推荐）

**Windows (PowerShell):**
```powershell
.\scripts\dev-setup.ps1
```

**Linux/Mac:**
```bash
chmod +x scripts/dev-setup.sh
./scripts/dev-setup.sh
```

### 3. 手动设置

如果自动设置脚本无法运行，请按照以下步骤手动设置：

#### 3.1 安装依赖
```bash
npm install
```

#### 3.2 登录 Cloudflare
```bash
npx wrangler login
```

#### 3.3 创建 KV 命名空间
```bash
# 创建预览 KV 命名空间（用于本地开发）
npx wrangler kv:namespace create LINKS --preview
```

记录输出的 `preview_id`，例如：
```
🌀 Creating namespace with title "myurls-workers-LINKS_preview"
✨ Success! Created KV namespace with id "abcd1234-efgh-5678-ijkl-9012mnop3456"
```

#### 3.4 更新配置文件
将上一步获得的 `preview_id` 更新到 `wrangler.toml` 文件中：

```toml
[[env.local.kv_namespaces]]
binding = "LINKS"
preview_id = "abcd1234-efgh-5678-ijkl-9012mnop3456"  # 替换为实际的 ID
```

#### 3.5 配置环境变量
编辑 `.dev.vars` 文件，设置管理员密码：
```
ADMIN_PASSWORD=your-secure-password
REQUIRE_AUTH=true
```

## 启动开发服务器

### 基本启动
```bash
npm run dev
```

### 调试模式启动
```bash
npm run dev:debug
```

服务器将在 `http://localhost:8788` 启动。

## 功能测试

### 1. 测试主页
访问 `http://localhost:8788`，应该能看到短链接生成页面。

### 2. 测试短链接生成
1. 在主页输入一个长链接
2. 可选择设置高级选项（访问次数限制、密码保护等）
3. 点击"生成短链接"
4. 确认能正常生成短链接

### 3. 测试短链接访问
1. 复制生成的短链接
2. 在新标签页访问该短链接
3. 确认能正确重定向到目标网站

### 4. 测试管理后台
1. 访问 `http://localhost:8788/admin`
2. 使用 `.dev.vars` 中设置的密码登录
3. 确认能看到链接列表和统计数据

### 5. 测试 API 端点

#### 创建短链接 API
```bash
curl -X POST http://localhost:8788/api/links \
  -H "Content-Type: application/json" \
  -d '{
    "longUrl": "https://example.com/test",
    "shortKey": "test123",
    "title": "测试链接",
    "maxVisits": 10
  }'
```

#### 获取链接列表 API（需要先登录获取 session）
```bash
curl -X GET http://localhost:8788/api/links \
  -H "Cookie: session=your-session-token"
```

## 开发工作流

### 1. 代码修改
- 修改 `functions/` 目录下的 API 代码
- 修改 `index.html` 或 `functions/admin.js` 中的前端代码
- Wrangler 会自动检测文件变化并重新加载

### 2. 查看日志
开发服务器会在控制台显示请求日志和错误信息。使用调试模式可以看到更详细的日志。

### 3. 调试技巧
- 使用浏览器开发者工具查看网络请求
- 在代码中添加 `console.log()` 语句
- 检查 KV 存储中的数据：
  ```bash
  npx wrangler kv:key list --namespace-id=your-preview-id
  npx wrangler kv:key get "key-name" --namespace-id=your-preview-id
  ```

## 常见问题

### 问题 1: KV 命名空间未找到
**错误信息**: `KV storage not configured`

**解决方案**:
1. 确认已创建 KV 命名空间
2. 检查 `wrangler.toml` 中的 `preview_id` 是否正确
3. 重启开发服务器

### 问题 2: 认证失败
**错误信息**: `Admin password not configured`

**解决方案**:
1. 检查 `.dev.vars` 文件是否存在
2. 确认 `ADMIN_PASSWORD` 已设置
3. 重启开发服务器

### 问题 3: 端口被占用
**错误信息**: `Port 8788 is already in use`

**解决方案**:
```bash
# 使用不同端口
npx wrangler pages dev . --kv LINKS --port 8789
```

### 问题 4: 函数执行错误
查看控制台日志，通常是代码语法错误或依赖问题。

## 项目结构说明

```
MyUrls-Workers/
├── functions/                 # Cloudflare Pages Functions
│   ├── api/                  # API 端点
│   ├── utils/               # 工具函数
│   ├── [shortKey].js       # 短链接访问处理
│   ├── admin.js            # 管理后台
│   └── short.js            # 兼容 API
├── scripts/                 # 开发脚本
├── docs/                    # 文档
├── index.html              # 主页面
├── package.json            # 项目配置
├── wrangler.toml           # Cloudflare 配置
├── .dev.vars              # 本地环境变量
└── .gitignore             # Git 忽略文件
```

## 部署到生产环境

本地开发完成后，可以部署到 Cloudflare Pages：

1. 推送代码到 GitHub
2. 在 Cloudflare Pages 中连接仓库
3. 配置生产环境的 KV 命名空间和环境变量
4. 部署项目

详细部署指南请参考 [deployment-guide.md](./deployment-guide.md)。

## 贡献代码

1. Fork 项目
2. 创建功能分支
3. 在本地开发和测试
4. 提交 Pull Request

## 获取帮助

如果遇到问题：
1. 查看控制台日志
2. 检查 [Issues](https://github.com/kiko923/MyUrls-Workers/issues)
3. 提交新的 Issue
