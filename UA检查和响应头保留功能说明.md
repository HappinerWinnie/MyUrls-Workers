# MyUrls 服务器端ClashMeta UA和响应头保留功能

## 功能概述

已为MyUrls短链接服务添加了服务器端ClashMeta User-Agent和原始响应头保留功能，专门针对Clash订阅链接需求进行优化。

## 新增功能

### 1. 服务器端ClashMeta User-Agent

**功能**：服务器端访问原始链接时自动使用ClashMeta User-Agent

**实现位置**：
- `functions/[shortKey].js` - Cloudflare Workers版本
- `simple-dev-server.js` - 开发服务器版本

**实现逻辑**：
```javascript
// 服务器端访问原始链接时使用ClashMeta UA
const headResponse = await fetch(linkData.longUrl, {
  method: 'HEAD',
  headers: {
    'User-Agent': 'ClashMeta/1.18.0', // 固定使用ClashMeta UA
    'Accept': request.headers.get('accept') || '*/*',
    'Accept-Language': request.headers.get('accept-language') || 'en-US,en;q=0.9',
  }
});
```

**适用模式**：
- ✅ 直接跳转模式 (redirect)
- ✅ 代理访问模式 (proxy)
- ❌ iframe嵌入模式（不需要服务器端访问）

### 2. 响应头保留

**保留的重要响应头**：

#### 通用响应头
- `content-type` - 内容类型
- `content-length` - 内容长度
- `content-disposition` - 内容处置（下载文件名等）
- `cache-control` - 缓存控制
- `expires` - 过期时间
- `last-modified` - 最后修改时间
- `etag` - 实体标签

#### Clash专用响应头
- `subscription-userinfo` - 订阅用户信息（流量、到期时间等）
- `profile-update-interval` - 订阅更新间隔
- `subscription-title` - 订阅标题

## 技术实现

### 直接跳转模式 (redirect)

**Cloudflare Workers版本**：
```javascript
// 先发起HEAD请求获取响应头，使用ClashMeta UA
const headResponse = await fetch(linkData.longUrl, {
  method: 'HEAD',
  headers: {
    'User-Agent': 'ClashMeta/1.18.0', // 服务器端固定使用ClashMeta UA
    'Accept': request.headers.get('accept') || '*/*',
    'Accept-Language': request.headers.get('accept-language') || 'en-US,en;q=0.9',
  }
});

// 创建重定向响应，保留重要的响应头
const redirectHeaders = {
  'Location': linkData.longUrl
};

// 保留重要的响应头
const preserveHeaders = [
  'subscription-userinfo',
  'content-disposition',
  'content-type',
  // ... 其他响应头
];

for (const headerName of preserveHeaders) {
  const headerValue = headResponse.headers.get(headerName);
  if (headerValue) {
    redirectHeaders[headerName] = headerValue;
  }
}

return new Response(null, {
  status: 302,
  headers: redirectHeaders
});
```

**开发服务器版本**：
```javascript
// 使用Node.js原生HTTP模块获取响应头
const headRequest = protocol.request({
  hostname: targetUrl.hostname,
  port: targetUrl.port,
  path: targetUrl.pathname + targetUrl.search,
  method: 'HEAD',
  headers: {
    'User-Agent': 'ClashMeta/1.18.0', // 服务器端固定使用ClashMeta UA
    'Accept': req.headers['accept'] || '*/*'
  }
}, (headRes) => {
  // 构建重定向响应头，保留重要响应头
  const redirectHeaders = { 'Location': linkData.longUrl };

  for (const headerName of preserveHeaders) {
    const headerValue = headRes.headers[headerName.toLowerCase()];
    if (headerValue) {
      redirectHeaders[headerName] = headerValue;
    }
  }

  res.writeHead(302, redirectHeaders);
  res.end();
});
```

### 代理访问模式 (proxy)

在代理模式中，响应头保留更加直接：

```javascript
// 复制重要的响应头（包括用户指定的特殊响应头）
const preserveHeaders = [
  'content-type', 'content-length', 'cache-control', 'expires',
  'last-modified', 'etag', 'content-encoding', 'content-disposition',
  'subscription-userinfo', // Clash订阅信息
  'profile-update-interval', // 订阅更新间隔
  'subscription-title', // 订阅标题
  'content-encoding', // 内容编码
  'accept-ranges', // 范围请求支持
  'vary' // 缓存变化
];

for (const header of preserveHeaders) {
  const value = response.headers.get(header);
  if (value) {
    responseHeaders.set(header, value);
  }
}
```

## 使用场景

### Clash订阅链接

这些功能特别适用于Clash订阅链接的短链接化：

1. **User-Agent检查**：
   - 确保只有ClashMeta客户端可以访问
   - 防止其他爬虫或浏览器访问
   - 提高订阅链接的安全性

2. **响应头保留**：
   - `subscription-userinfo`：显示用户流量使用情况
   - `content-disposition`：正确的文件下载名称
   - `cache-control`：合适的缓存策略

### 示例HTTP响应

**原始订阅链接响应**：
```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="config.yaml"
Subscription-Userinfo: upload=0; download=1073741824; total=10737418240; expire=1703980800
Cache-Control: no-cache

# Clash配置内容...
```

**短链接重定向响应**：
```http
HTTP/1.1 302 Found
Location: https://original-subscription-url.com/config
Content-Type: text/plain; charset=utf-8
Content-Disposition: attachment; filename="config.yaml"
Subscription-Userinfo: upload=0; download=1073741824; total=10737418240; expire=1703980800
Cache-Control: no-cache
```

## 错误处理

### User-Agent检查失败
```http
HTTP/1.1 403 Forbidden
Content-Type: text/plain

Access denied: Invalid User-Agent
```

### 响应头获取失败
- 如果无法获取目标URL的响应头，仍会进行重定向
- 设置5秒超时，避免长时间等待
- 出错时回退到简单重定向

## 兼容性说明

1. **向后兼容**：现有短链接继续正常工作
2. **可选功能**：UA检查只在访问时进行，不影响链接创建
3. **优雅降级**：响应头获取失败时仍能正常重定向

## 测试方法

### 测试User-Agent检查

```bash
# 正确的User-Agent（应该成功）
curl -H "User-Agent: ClashMeta/1.0" http://short.ly/abc123

# 错误的User-Agent（应该被拒绝）
curl -H "User-Agent: Mozilla/5.0" http://short.ly/abc123
```

### 测试响应头保留

```bash
# 检查重定向响应头
curl -I -H "User-Agent: ClashMeta/1.0" http://short.ly/abc123

# 应该看到保留的响应头，如：
# Location: https://target-url.com
# Subscription-Userinfo: upload=0; download=1073741824; total=10737418240
# Content-Disposition: attachment; filename="config.yaml"
```

## 总结

这些功能增强了MyUrls对Clash订阅链接的支持：

- **安全性**：通过UA检查限制访问
- **功能性**：保留重要的响应头信息
- **兼容性**：不影响现有功能和其他用途的短链接

特别适用于需要保护和优化Clash订阅链接的场景。
