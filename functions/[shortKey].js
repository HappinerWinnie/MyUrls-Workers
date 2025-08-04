// functions/[shortKey].js - 短链接访问处理，支持访问次数限制等功能
import { isExpired, verifyPassword } from './utils/crypto.js';
import { htmlResponse, redirectResponse, notFoundResponse, forbiddenResponse } from './utils/response.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const kv = env.LINKS;
  const analytics = env.ANALYTICS; // Analytics Engine (可选)

  if (!kv) {
    return new Response("Service not configured", { status: 500 });
  }

  // 从路径中获取 shortKey
  const shortKey = params.shortKey;
  if (!shortKey) {
    return notFoundResponse("Invalid short key");
  }

  // 从 KV 中获取链接数据
  const linkDataStr = await kv.get(shortKey);
  if (!linkDataStr) {
    return notFoundResponse("Short link not found");
  }

  let linkData;
  try {
    linkData = JSON.parse(linkDataStr);
  } catch (error) {
    // 兼容旧版本数据（直接存储URL字符串）
    return Response.redirect(linkDataStr, 301);
  }

  // 检查链接是否激活
  if (!linkData.isActive) {
    return forbiddenResponse("This link has been disabled");
  }

  // 检查是否过期
  if (linkData.expiresAt && isExpired(linkData.expiresAt)) {
    return forbiddenResponse("This link has expired");
  }

  // 检查访问次数限制（核心功能）
  if (linkData.maxVisits > 0 && linkData.currentVisits >= linkData.maxVisits) {
    return forbiddenResponse("This link has reached its visit limit");
  }

  // 处理密码保护
  if (linkData.password) {
    return await handlePasswordProtection(request, linkData, kv);
  }

  // 处理不同的访问模式
  switch (linkData.accessMode) {
    case 'warning':
      return await handleWarningMode(request, linkData);
    case 'proxy':
      // 更新访问统计
      await updateVisitStats(linkData, kv, request, analytics);
      return await handleProxyMode(request, linkData);
    case 'iframe':
      // 更新访问统计
      await updateVisitStats(linkData, kv, request, analytics);
      return await handleIframeMode(request, linkData);
    case 'redirect':
    default:
      return await handleRedirectMode(request, linkData, kv, analytics);
  }
}

/**
 * 处理密码保护模式
 */
async function handlePasswordProtection(request, linkData, kv) {
  const url = new URL(request.url);
  const password = url.searchParams.get('password');

  if (!password) {
    // 返回密码输入页面
    return htmlResponse(getPasswordPage(linkData.shortKey));
  }

  // 验证密码
  const isValid = await verifyPassword(password, linkData.password);
  if (!isValid) {
    return htmlResponse(getPasswordPage(linkData.shortKey, 'Invalid password'));
  }

  // 密码正确，继续处理访问
  return await handleRedirectMode(request, linkData, kv);
}

/**
 * 处理警告模式
 */
async function handleWarningMode(request, linkData) {
  const url = new URL(request.url);
  const confirmed = url.searchParams.get('confirmed');

  if (!confirmed) {
    return htmlResponse(getWarningPage(linkData));
  }

  return redirectResponse(linkData.longUrl);
}

/**
 * 处理代理模式 - 完全隐藏目标URL
 */
async function handleProxyMode(request, linkData) {
  try {
    // 构建代理请求
    const targetUrl = new URL(linkData.longUrl);
    const requestUrl = new URL(request.url);

    // 保持原始请求的查询参数（除了内部参数）
    const proxyUrl = new URL(linkData.longUrl);
    for (const [key, value] of requestUrl.searchParams) {
      if (!['password', 'confirmed', 'secure'].includes(key)) {
        proxyUrl.searchParams.set(key, value);
      }
    }

    // 构建代理请求头
    const proxyHeaders = new Headers();

    // 设置ClashMeta User-Agent访问原始链接
    proxyHeaders.set('user-agent', 'ClashMeta');

    // 复制其他重要的请求头
    const importantHeaders = ['accept', 'accept-language', 'cache-control'];
    for (const header of importantHeaders) {
      const value = request.headers.get(header);
      if (value) {
        proxyHeaders.set(header, value);
      }
    }

    // 设置正确的Host头
    proxyHeaders.set('host', targetUrl.host);

    // 设置Referer为目标域名，避免防盗链检测
    proxyHeaders.set('referer', targetUrl.origin);

    // 发起代理请求
    const response = await fetch(proxyUrl.toString(), {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined
    });

    // 处理响应头
    const responseHeaders = new Headers();

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

    // 添加安全头
    responseHeaders.set('x-frame-options', 'SAMEORIGIN');
    responseHeaders.set('x-content-type-options', 'nosniff');
    responseHeaders.set('referrer-policy', 'no-referrer');

    // 处理HTML内容，修复相对链接
    let body = response.body;
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/html')) {
      const html = await response.text();
      const modifiedHtml = modifyHtmlContent(html, targetUrl, requestUrl);
      body = modifiedHtml;
      responseHeaders.set('content-length', new TextEncoder().encode(modifiedHtml).length.toString());
    }

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return htmlResponse(getProxyErrorPage(error.message));
  }
}

/**
 * 处理iframe嵌入模式
 */
async function handleIframeMode(request, linkData) {
  return htmlResponse(getIframePage(linkData.longUrl, linkData.title));
}

/**
 * 处理重定向模式（默认）
 */
async function handleRedirectMode(request, linkData, kv, analytics) {
  // 更新访问统计
  await updateVisitStats(linkData, kv, request, analytics);

  // 获取目标URL的响应头信息
  try {
    // 先发起HEAD请求获取响应头，使用ClashMeta User-Agent
    const headResponse = await fetch(linkData.longUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'ClashMeta/1.18.0', // 服务器端访问原始链接时使用ClashMeta UA
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
      'cache-control',
      'expires',
      'last-modified',
      'etag'
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

  } catch (error) {
    console.error('Error fetching target URL headers:', error);
    // 如果获取响应头失败，仍然进行重定向
    return redirectResponse(linkData.longUrl);
  }
}

/**
 * 修改HTML内容，处理相对链接
 */
function modifyHtmlContent(html, targetUrl, requestUrl) {
  try {
    // 简单的相对链接修复
    const baseUrl = targetUrl.origin;

    // 修复相对链接
    html = html.replace(/href="\/([^"]*?)"/g, `href="${baseUrl}/$1"`);
    html = html.replace(/src="\/([^"]*?)"/g, `src="${baseUrl}/$1"`);

    // 修复相对路径（不以/开头）
    html = html.replace(/href="(?!https?:\/\/|\/|#)([^"]*?)"/g, `href="${targetUrl.href.replace(/\/[^\/]*$/, '')}/$1"`);
    html = html.replace(/src="(?!https?:\/\/|\/|#)([^"]*?)"/g, `src="${targetUrl.href.replace(/\/[^\/]*$/, '')}/$1"`);

    // 添加base标签
    const baseTag = `<base href="${targetUrl.origin}">`;
    html = html.replace(/<head>/i, `<head>\n${baseTag}`);

    return html;
  } catch (error) {
    console.error('HTML modification error:', error);
    return html; // 返回原始HTML
  }
}

/**
 * 更新访问统计
 */
async function updateVisitStats(linkData, kv, request, analytics) {
  try {
    // 增加访问次数
    linkData.currentVisits++;
    linkData.totalVisits++;
    linkData.lastVisitAt = new Date().toISOString();

    // 记录访问历史（保留最近10次）
    const visitRecord = {
      timestamp: new Date().toISOString(),
      ip: request.headers.get('CF-Connecting-IP') || 'unknown',
      userAgent: request.headers.get('User-Agent') || 'unknown',
      referer: request.headers.get('Referer') || 'direct'
    };

    linkData.visitHistory = linkData.visitHistory || [];
    linkData.visitHistory.unshift(visitRecord);
    if (linkData.visitHistory.length > 10) {
      linkData.visitHistory = linkData.visitHistory.slice(0, 10);
    }

    linkData.updatedAt = new Date().toISOString();

    // 保存更新后的数据
    await kv.put(linkData.shortKey, JSON.stringify(linkData));

    // 发送到 Analytics Engine（如果配置了）
    if (analytics) {
      analytics.writeDataPoint({
        blobs: [linkData.shortKey, visitRecord.ip, visitRecord.referer],
        doubles: [1], // 访问次数
        indexes: [linkData.shortKey]
      });
    }
  } catch (error) {
    console.error('Failed to update visit stats:', error);
  }
}

/**
 * 生成iframe嵌入页面
 */
function getIframePage(targetUrl, title = '') {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title ? title + ' - ' : ''}MyUrls</title>
    <style>
        body, html {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100vh;
            border: none;
        }
        .loading {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-family: Arial, sans-serif;
            color: #666;
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">正在加载...</div>
    <iframe src="${targetUrl}" onload="document.getElementById('loading').style.display='none'"></iframe>
</body>
</html>`;
}

/**
 * 生成代理错误页面
 */
function getProxyErrorPage(errorMessage) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>访问失败 - MyUrls</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .glass-effect {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-effect rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <div class="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
            </svg>
        </div>
        <h2 class="text-2xl font-bold text-white mb-4">访问失败</h2>
        <p class="text-white opacity-75 mb-6">无法访问目标页面</p>
        <div class="text-white opacity-50 text-sm">
            <p>错误信息: ${errorMessage}</p>
        </div>
        <div class="mt-6">
            <button onclick="history.back()" class="px-6 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200">
                返回
            </button>
        </div>
    </div>
</body>
</html>`;
}

/**
 * 生成安全重定向页面
 */
function getSecureRedirectPage(targetUrl, title = '') {
  // 对URL进行Base64编码以避免在HTML源码中直接暴露
  const encodedUrl = btoa(encodeURIComponent(targetUrl));

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title ? title + ' - ' : ''}正在跳转 - MyUrls</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .glass-effect {
          background: rgba(255, 255, 255, 0.25);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .spinner {
          border: 3px solid rgba(255, 255, 255, 0.3);
          border-radius: 50%;
          border-top: 3px solid white;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center p-4">
    <div class="glass-effect rounded-2xl p-8 w-full max-w-md shadow-2xl text-center">
        <div class="spinner mx-auto mb-6"></div>
        <h2 class="text-2xl font-bold text-white mb-4">正在跳转...</h2>
        <p class="text-white opacity-75 mb-6">请稍候，即将为您跳转到目标页面</p>
        <div class="text-white opacity-50 text-sm">
            <p>如果页面没有自动跳转，请点击下方按钮</p>
            <button id="manualRedirect" class="mt-4 px-6 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200">
                手动跳转
            </button>
        </div>
    </div>

    <script>
        // 解码目标URL
        const encodedUrl = '${encodedUrl}';
        let targetUrl;

        try {
            targetUrl = decodeURIComponent(atob(encodedUrl));
        } catch (e) {
            console.error('URL解码失败');
            document.body.innerHTML = '<div class="text-center text-white p-8">链接解析失败</div>';
        }

        // 自动跳转（延迟1秒以显示加载动画）
        setTimeout(() => {
            if (targetUrl) {
                window.location.href = targetUrl;
            }
        }, 1000);

        // 手动跳转按钮
        document.getElementById('manualRedirect').addEventListener('click', () => {
            if (targetUrl) {
                window.location.href = targetUrl;
            }
        });

        // 防止页面被嵌入iframe（安全措施）
        if (window.top !== window.self) {
            window.top.location = window.location;
        }
    </script>
</body>
</html>`;
}

/**
 * 生成密码输入页面
 */
function getPasswordPage(shortKey, error = '') {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>密码保护 - MyUrls</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
        .form-group { margin-bottom: 15px; }
        label { display: block; margin-bottom: 5px; }
        input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007cba; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
        .error { color: red; margin-bottom: 15px; }
    </style>
</head>
<body>
    <h2>此链接需要密码访问</h2>
    ${error ? `<div class="error">${error}</div>` : ''}
    <form method="get">
        <div class="form-group">
            <label for="password">请输入访问密码：</label>
            <input type="password" id="password" name="password" required>
        </div>
        <button type="submit">访问</button>
    </form>
</body>
</html>`;
}

/**
 * 生成警告页面
 */
function getWarningPage(linkData) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>访问确认 - MyUrls</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 500px; margin: 100px auto; padding: 20px; }
        .warning { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin-bottom: 20px; }
        .buttons { text-align: center; }
        .btn { display: inline-block; padding: 10px 20px; margin: 0 10px; text-decoration: none; border-radius: 4px; }
        .btn-primary { background: #007cba; color: white; }
        .btn-secondary { background: #6c757d; color: white; }
    </style>
</head>
<body>
    <div class="warning">
        <h3>⚠️ 访问确认</h3>
        <p>您即将访问外部链接：</p>
        <p><strong>${linkData.longUrl}</strong></p>
        <p>请确认您信任此链接后再继续访问。</p>
    </div>
    <div class="buttons">
        <a href="?confirmed=1" class="btn btn-primary">继续访问</a>
        <a href="javascript:history.back()" class="btn btn-secondary">返回</a>
    </div>
</body>
</html>`;
}
