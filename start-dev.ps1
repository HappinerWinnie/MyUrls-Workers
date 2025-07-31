# 快速启动本地开发服务器
# 使用方法：在项目根目录运行 .\start-dev.ps1

Write-Host "🚀 启动 MyUrls 本地开发服务器..." -ForegroundColor Green

# 检查是否已安装依赖
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 首次运行，正在安装依赖..." -ForegroundColor Yellow
    npm install
}

# 检查 .dev.vars 文件
if (-not (Test-Path ".dev.vars")) {
    Write-Host "⚠️  未找到 .dev.vars 文件，创建默认配置..." -ForegroundColor Yellow
    @"
# 本地开发环境变量
ADMIN_PASSWORD=admin123
REQUIRE_AUTH=true
"@ | Out-File -FilePath ".dev.vars" -Encoding UTF8
    Write-Host "✅ 已创建 .dev.vars 文件，默认管理员密码: admin123" -ForegroundColor Green
}

# 检查 wrangler.toml 配置
Write-Host "🔧 检查配置文件..." -ForegroundColor Yellow
$wranglerContent = Get-Content "wrangler.toml" -Raw
if ($wranglerContent -match "your-preview-kv-namespace-id") {
    Write-Host "⚠️  检测到 KV 命名空间未配置" -ForegroundColor Yellow
    Write-Host "请先运行以下命令创建 KV 命名空间：" -ForegroundColor Cyan
    Write-Host "npx wrangler kv:namespace create LINKS --preview" -ForegroundColor Cyan
    Write-Host "然后将返回的 preview_id 更新到 wrangler.toml 文件中" -ForegroundColor Cyan
    Write-Host ""
    $continue = Read-Host "是否继续启动？(y/N)"
    if ($continue -ne "y" -and $continue -ne "Y") {
        exit 0
    }
}

Write-Host "🌐 启动开发服务器..." -ForegroundColor Green
Write-Host "服务器将在 http://localhost:8788 启动" -ForegroundColor Cyan
Write-Host "管理后台: http://localhost:8788/admin" -ForegroundColor Cyan
Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Yellow
Write-Host ""

# 启动开发服务器
npm run dev
