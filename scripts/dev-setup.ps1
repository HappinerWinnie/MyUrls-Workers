# PowerShell 脚本：本地开发环境设置
# 使用方法：在项目根目录运行 .\scripts\dev-setup.ps1

Write-Host "🚀 MyUrls 本地开发环境设置" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

# 检查 Node.js
Write-Host "📦 检查 Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 版本: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 未找到 Node.js，请先安装 Node.js (https://nodejs.org/)" -ForegroundColor Red
    exit 1
}

# 检查 npm
Write-Host "📦 检查 npm..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "✅ npm 版本: $npmVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ 未找到 npm" -ForegroundColor Red
    exit 1
}

# 安装依赖
Write-Host "📦 安装项目依赖..." -ForegroundColor Yellow
npm install

# 检查 Wrangler
Write-Host "🔧 检查 Wrangler CLI..." -ForegroundColor Yellow
try {
    $wranglerVersion = npx wrangler --version
    Write-Host "✅ Wrangler 版本: $wranglerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Wrangler 安装失败" -ForegroundColor Red
    exit 1
}

# 登录 Cloudflare（如果需要）
Write-Host "🔐 检查 Cloudflare 登录状态..." -ForegroundColor Yellow
try {
    $whoami = npx wrangler whoami 2>$null
    if ($whoami -match "You are logged in") {
        Write-Host "✅ 已登录 Cloudflare" -ForegroundColor Green
    } else {
        Write-Host "⚠️  未登录 Cloudflare，请运行: npx wrangler login" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  请先登录 Cloudflare: npx wrangler login" -ForegroundColor Yellow
}

# 创建 KV 命名空间（如果需要）
Write-Host "🗄️  KV 命名空间设置..." -ForegroundColor Yellow
Write-Host "如果这是首次设置，请运行以下命令创建 KV 命名空间：" -ForegroundColor Cyan
Write-Host "npx wrangler kv:namespace create LINKS --preview" -ForegroundColor Cyan
Write-Host "然后将返回的 preview_id 更新到 wrangler.toml 文件中" -ForegroundColor Cyan

Write-Host ""
Write-Host "🎉 设置完成！" -ForegroundColor Green
Write-Host "运行以下命令启动本地开发服务器：" -ForegroundColor Cyan
Write-Host "npm run dev" -ForegroundColor Cyan
Write-Host ""
Write-Host "或者使用调试模式：" -ForegroundColor Cyan
Write-Host "npm run dev:debug" -ForegroundColor Cyan
