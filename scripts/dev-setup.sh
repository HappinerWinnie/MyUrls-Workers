#!/bin/bash
# Bash 脚本：本地开发环境设置
# 使用方法：在项目根目录运行 chmod +x scripts/dev-setup.sh && ./scripts/dev-setup.sh

echo "🚀 MyUrls 本地开发环境设置"
echo "================================"

# 检查 Node.js
echo "📦 检查 Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js 版本: $NODE_VERSION"
else
    echo "❌ 未找到 Node.js，请先安装 Node.js (https://nodejs.org/)"
    exit 1
fi

# 检查 npm
echo "📦 检查 npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✅ npm 版本: $NPM_VERSION"
else
    echo "❌ 未找到 npm"
    exit 1
fi

# 安装依赖
echo "📦 安装项目依赖..."
npm install

# 检查 Wrangler
echo "🔧 检查 Wrangler CLI..."
if npx wrangler --version &> /dev/null; then
    WRANGLER_VERSION=$(npx wrangler --version)
    echo "✅ Wrangler 版本: $WRANGLER_VERSION"
else
    echo "❌ Wrangler 安装失败"
    exit 1
fi

# 登录 Cloudflare（如果需要）
echo "🔐 检查 Cloudflare 登录状态..."
if npx wrangler whoami 2>/dev/null | grep -q "You are logged in"; then
    echo "✅ 已登录 Cloudflare"
else
    echo "⚠️  未登录 Cloudflare，请运行: npx wrangler login"
fi

# 创建 KV 命名空间（如果需要）
echo "🗄️  KV 命名空间设置..."
echo "如果这是首次设置，请运行以下命令创建 KV 命名空间："
echo "npx wrangler kv:namespace create LINKS --preview"
echo "然后将返回的 preview_id 更新到 wrangler.toml 文件中"

echo ""
echo "🎉 设置完成！"
echo "运行以下命令启动本地开发服务器："
echo "npm run dev"
echo ""
echo "或者使用调试模式："
echo "npm run dev:debug"
