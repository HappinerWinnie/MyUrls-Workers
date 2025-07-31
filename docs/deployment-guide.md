# 部署指南

本指南将帮助您在 Cloudflare Pages 上部署 MyUrls 短链接服务。

## 前置要求

- Cloudflare 账户
- GitHub 账户
- 基本的命令行操作知识

## 步骤 1: 准备代码

### 1.1 Fork 或克隆仓库

**方法一：Fork 仓库（推荐）**
1. 访问 [MyUrls-Workers](https://github.com/kiko923/MyUrls-Workers)
2. 点击右上角的 "Fork" 按钮
3. 选择您的 GitHub 账户

**方法二：克隆到本地**
```bash
git clone https://github.com/kiko923/MyUrls-Workers.git
cd MyUrls-Workers
```

## 步骤 2: 创建 KV 命名空间

### 2.1 安装 Wrangler CLI（如果还没有）
```bash
npm install -g wrangler
```

### 2.2 登录 Cloudflare
```bash
wrangler login
```

### 2.3 创建 KV 命名空间
```bash
# 创建生产环境 KV 命名空间
wrangler kv:namespace create "LINKS"

# 输出示例：
# 🌀 Creating namespace with title "MyUrls-LINKS"
# ✨ Success! Created KV namespace with id "abcd1234efgh5678"
```

记录下输出的命名空间 ID，稍后会用到。

## 步骤 3: 在 Cloudflare Pages 中创建项目

### 3.1 访问 Cloudflare Pages
1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 在左侧菜单中选择 "Pages"
3. 点击 "Create a project"

### 3.2 连接 GitHub 仓库
1. 选择 "Connect to Git"
2. 授权 Cloudflare 访问您的 GitHub 账户
3. 选择 MyUrls-Workers 仓库
4. 点击 "Begin setup"

### 3.3 配置构建设置
- **Project name**: 输入项目名称（如：myurls）
- **Production branch**: main
- **Build command**: 留空
- **Build output directory**: /

点击 "Save and Deploy"

## 步骤 4: 配置环境变量

### 4.1 设置环境变量
在项目部署完成后：
1. 进入项目设置页面
2. 选择 "Settings" > "Environment variables"
3. 添加以下环境变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `ADMIN_PASSWORD` | 您的管理员密码 | 用于登录管理后台 |
| `REQUIRE_AUTH` | `true` | 是否需要认证（生产环境建议为 true） |

### 4.2 绑定 KV 命名空间
1. 在项目设置中选择 "Functions"
2. 找到 "KV namespace bindings" 部分
3. 点击 "Add binding"
4. 设置：
   - **Variable name**: `LINKS`
   - **KV namespace**: 选择步骤 2.3 中创建的命名空间

## 步骤 5: 重新部署

配置完成后，需要重新部署项目：
1. 在项目页面点击 "Deployments"
2. 点击最新部署右侧的 "Retry deployment"
3. 或者推送新的代码到 GitHub 仓库触发自动部署

## 步骤 6: 验证部署

### 6.1 测试主页
访问您的 Pages 域名（如：https://myurls.pages.dev），应该能看到短链接生成页面。

### 6.2 测试管理后台
1. 访问 `https://your-domain.pages.dev/admin`
2. 使用步骤 4.1 中设置的密码登录
3. 确认能正常访问管理界面

### 6.3 测试短链接生成
1. 在主页输入一个长链接
2. 点击生成短链接
3. 确认能正常生成并访问短链接

## 可选配置

### 启用 Analytics Engine（可选）

如果您想要更详细的访问统计，可以启用 Analytics Engine：

1. 在 Cloudflare Dashboard 中创建 Analytics Engine 数据集
2. 在 Pages 项目设置中添加 Analytics Engine 绑定
3. 更新 `wrangler.toml` 配置文件

### 自定义域名

1. 在项目设置中选择 "Custom domains"
2. 点击 "Set up a custom domain"
3. 输入您的域名并按照指引完成设置

## 故障排除

### 常见问题

**问题 1: KV 命名空间未绑定**
- 错误信息：`KV storage not configured`
- 解决方案：确认已正确绑定 KV 命名空间，变量名为 `LINKS`

**问题 2: 管理员密码未设置**
- 错误信息：`Admin password not configured`
- 解决方案：在环境变量中设置 `ADMIN_PASSWORD`

**问题 3: 函数执行超时**
- 可能原因：KV 操作过多或网络问题
- 解决方案：检查 KV 命名空间状态，或联系 Cloudflare 支持

### 调试技巧

1. **查看函数日志**：在 Pages 项目的 "Functions" 页面可以查看实时日志
2. **使用浏览器开发者工具**：检查网络请求和控制台错误
3. **测试 API 端点**：使用 curl 或 Postman 直接测试 API

## 更新项目

当有新版本发布时：
1. 如果使用 Fork：在 GitHub 上同步 Fork 的仓库
2. 如果使用本地仓库：拉取最新代码并推送到您的仓库
3. Cloudflare Pages 会自动检测到更改并重新部署

## 安全建议

1. **使用强密码**：为管理员账户设置复杂密码
2. **定期更新**：保持项目代码为最新版本
3. **监控访问**：定期检查访问日志和统计数据
4. **备份数据**：定期导出重要的短链接数据

## 支持

如果在部署过程中遇到问题：
1. 查看项目的 [Issues](https://github.com/kiko923/MyUrls-Workers/issues)
2. 提交新的 Issue 描述您的问题
3. 参考 Cloudflare Pages 官方文档
