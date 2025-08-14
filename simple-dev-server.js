// 简化的本地开发服务器
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 模拟 KV 存储
const mockKV = new Map();

// 模拟环境变量
const mockEnv = {
  LINKS: {
    get: async (key) => mockKV.get(key) || null,
    put: async (key, value, options = {}) => {
      mockKV.set(key, value);
      if (options.expirationTtl) {
        setTimeout(() => mockKV.delete(key), options.expirationTtl * 1000);
      }
    },
    delete: async (key) => mockKV.delete(key),
    list: async (options = {}) => {
      const keys = Array.from(mockKV.keys());
      const filteredKeys = options.prefix 
        ? keys.filter(key => key.startsWith(options.prefix))
        : keys;
      
      return {
        keys: filteredKeys.slice(0, options.limit || 1000).map(name => ({ name }))
      };
    }
  },
  ADMIN_PASSWORD: 'admin123',
  REQUIRE_AUTH: 'true'
};

// 简单的 Response 类
class SimpleResponse {
  constructor(body, init = {}) {
    this.body = body;
    this.status = init.status || 200;
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  static redirect(url, status = 302) {
    return new SimpleResponse(null, {
      status,
      headers: { Location: url }
    });
  }
}

// 简单的 Request 类
class SimpleRequest {
  constructor(url, init = {}) {
    this.url = url;
    this.method = init.method || 'GET';
    this.headers = new Map(Object.entries(init.headers || {}));
    this._body = init.body;
  }

  async json() {
    return JSON.parse(this._body);
  }

  async text() {
    return this._body;
  }

  async formData() {
    const formData = new Map();
    if (this._body) {
      const params = new URLSearchParams(this._body);
      for (const [key, value] of params) {
        formData.set(key, value);
      }
    }
    return formData;
  }
}

// 设置全局变量
global.Response = SimpleResponse;
global.Request = SimpleRequest;

// MIME 类型映射
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
    
    const mimeType = getMimeType(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
}

// 处理 API 请求的简化版本
async function handleAPI(pathname, method, body, res, req = null) {
  try {
    let result;

    // 简化的认证检查
    const needsAuth = pathname.startsWith('/api/links') && (method === 'GET' || method === 'PUT' || method === 'DELETE');
    const isAuthRequest = pathname.startsWith('/api/auth');

    if (needsAuth && !isAuthRequest) {
      // 简化版本：检查session cookie或直接允许（开发环境）
      const cookies = req?.headers?.cookie || '';
      const hasValidSession = cookies.includes('session=') || true; // 开发环境直接允许

      if (!hasValidSession) {
        result = {
          success: false,
          error: { message: 'Authentication required' }
        };
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }
    }
    
    if (pathname === '/api/links' && method === 'POST') {
      // 创建短链接
      const data = JSON.parse(body);
      const shortKey = data.shortKey || generateRandomKey(6);
      
      // 检查是否已存在
      if (mockKV.has(shortKey)) {
        result = {
          success: false,
          error: { message: `Short key "${shortKey}" already exists` }
        };
      } else {
        const linkData = {
          id: generateUUID(),
          longUrl: data.longUrl,
          shortKey: shortKey,
          title: data.title || '',
          description: data.description || '',
          password: data.password ? await hashPassword(data.password) : null,
          maxVisits: data.maxVisits || -1,
          currentVisits: 0,
          expiresAt: data.expiryDays ? new Date(Date.now() + data.expiryDays * 24 * 60 * 60 * 1000).toISOString() : null,
          accessMode: data.accessMode || 'proxy', // 默认使用代理模式
          customHeaders: data.customHeaders || {}, // 自定义响应头
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          createdBy: 'anonymous',
          tags: [],
          isActive: true,
          totalVisits: 0,
          lastVisitAt: null,
          visitHistory: []
        };
        
        mockKV.set(shortKey, JSON.stringify(linkData));
        
        result = {
          success: true,
          message: 'Link created successfully',
          data: {
            id: linkData.id,
            shortUrl: `http://localhost:8788/${shortKey}`,
            shortKey: shortKey,
            longUrl: linkData.longUrl,
            title: linkData.title,
            maxVisits: linkData.maxVisits,
            expiresAt: linkData.expiresAt,
            createdAt: linkData.createdAt
          }
        };
      }
    } else if (pathname === '/api/links' && method === 'GET') {
      // 获取链接列表
      const links = [];
      for (const [shortKey, linkDataStr] of mockKV.entries()) {
        try {
          const linkData = JSON.parse(linkDataStr);
          links.push(linkData);
        } catch (error) {
          console.error('Error parsing link data:', error);
        }
      }

      result = {
        success: true,
        data: {
          links: links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        }
      };
    } else if (pathname.startsWith('/api/links/') && method === 'GET') {
      // 获取单个链接详情
      const shortKey = pathname.split('/')[3];
      const linkDataStr = mockKV.get(shortKey);

      if (!linkDataStr) {
        result = {
          success: false,
          error: { message: 'Link not found' }
        };
      } else {
        try {
          const linkData = JSON.parse(linkDataStr);
          result = {
            success: true,
            data: linkData
          };
        } catch (e) {
          result = {
            success: false,
            error: { message: 'Invalid link data format' }
          };
        }
      }
    } else if (pathname.startsWith('/api/links/') && method === 'PUT') {
      // 更新链接
      let shortKey = pathname.split('/')[3];
      const linkDataStr = mockKV.get(shortKey);

      if (!linkDataStr) {
        result = {
          success: false,
          error: { message: 'Link not found' }
        };
      } else {
        const linkData = JSON.parse(linkDataStr);
        const updateData = JSON.parse(body);

        // 更新所有字段 - 支持完整的字段修改
        if (updateData.longUrl !== undefined) {
          linkData.longUrl = updateData.longUrl;
        }
        if (updateData.shortKey !== undefined && updateData.shortKey !== linkData.shortKey) {
          // 处理shortKey变更
          const newShortKey = updateData.shortKey;
          if (mockKV.has(newShortKey)) {
            result = {
              success: false,
              error: { message: `Short key "${newShortKey}" already exists` }
            };
            res.writeHead(409, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(result));
            return;
          }
          // 删除旧key，使用新key
          mockKV.delete(shortKey);
          linkData.shortKey = newShortKey;
          shortKey = newShortKey; // 更新变量以便后续保存
        }
        if (updateData.title !== undefined) {
          linkData.title = updateData.title;
        }
        if (updateData.description !== undefined) {
          linkData.description = updateData.description;
        }
        if (updateData.maxVisits !== undefined) {
          linkData.maxVisits = parseInt(updateData.maxVisits) || -1;
        }
        if (updateData.currentVisits !== undefined) {
          linkData.currentVisits = Math.max(0, parseInt(updateData.currentVisits) || 0);
        }
        if (updateData.expiryDays !== undefined && updateData.expiryDays) {
          const days = parseInt(updateData.expiryDays);
          linkData.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        }
        if (updateData.password !== undefined) {
          linkData.password = updateData.password; // 简化版本，不做哈希
        }
        if (updateData.accessMode !== undefined) {
          linkData.accessMode = updateData.accessMode;
        }
        if (updateData.tags !== undefined) {
          linkData.tags = updateData.tags;
        }
        if (updateData.isActive !== undefined) {
          linkData.isActive = updateData.isActive;
        }
        if (updateData.customHeaders !== undefined) {
          linkData.customHeaders = updateData.customHeaders;
        }
        if (updateData.subscriptionInfo !== undefined) {
          // 构建subscription-userinfo响应头
          const info = updateData.subscriptionInfo;
          if (info.upload || info.download || info.total || info.expire) {
            if (!linkData.customHeaders) linkData.customHeaders = {};
            const parts = [];
            if (info.upload) parts.push(`upload=${Math.round(parseFloat(info.upload) * 1024 * 1024 * 1024)}`);
            else parts.push('upload=0');
            if (info.download) parts.push(`download=${Math.round(parseFloat(info.download) * 1024 * 1024 * 1024)}`);
            else parts.push('download=0');
            if (info.total) parts.push(`total=${Math.round(parseFloat(info.total) * 1024 * 1024 * 1024)}`);
            if (info.expire) parts.push(`expire=${Math.floor(new Date(info.expire).getTime() / 1000)}`);
            linkData.customHeaders['subscription-userinfo'] = parts.join('; ');
          }
        }
        if (updateData.contentDisposition !== undefined) {
          // 构建content-disposition响应头
          const disp = updateData.contentDisposition;
          if (disp.type && disp.filename) {
            if (!linkData.customHeaders) linkData.customHeaders = {};
            linkData.customHeaders['content-disposition'] = `${disp.type}; filename*=UTF-8''${encodeURIComponent(disp.filename)}`;
          }
        }

        linkData.updatedAt = new Date().toISOString();
        mockKV.set(shortKey, JSON.stringify(linkData));

        result = {
          success: true,
          message: 'Link updated successfully',
          data: linkData
        };
      }
    } else if (pathname.startsWith('/api/links/') && method === 'DELETE') {
      // 删除链接
      const shortKey = pathname.split('/')[3];

      if (mockKV.has(shortKey)) {
        mockKV.delete(shortKey);
        result = {
          success: true,
          message: 'Link deleted successfully'
        };
      } else {
        result = {
          success: false,
          error: { message: 'Link not found' }
        };
      }
    } else {
      result = {
        success: false,
        error: { message: 'API endpoint not implemented yet' }
      };
    }
    
    res.writeHead(200, { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie'
    });
    res.end(JSON.stringify(result));
    
  } catch (error) {
    console.error('API Error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      success: false, 
      error: { message: 'Internal server error' } 
    }));
  }
}

// 处理短链接访问
async function handleShortLink(shortKey, query, res, req) {
  try {
    const linkDataStr = mockKV.get(shortKey);
    if (!linkDataStr) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Short link not found');
      return;
    }

    const linkData = JSON.parse(linkDataStr);

    // 检查是否激活
    if (!linkData.isActive) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('This link has been disabled');
      return;
    }

    // 检查是否过期
    if (linkData.expiresAt && new Date(linkData.expiresAt) < new Date()) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('This link has expired');
      return;
    }

    // 检查访问次数限制（核心功能）
    if (linkData.maxVisits > 0 && linkData.currentVisits >= linkData.maxVisits) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('This link has reached its visit limit');
      return;
    }

    // 处理密码保护
    if (linkData.password) {
      const password = query.password;

      if (!password) {
        // 返回密码输入页面
        const passwordPage = getPasswordPage(shortKey);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(passwordPage);
        return;
      }

      // 验证密码
      const isValid = await verifyPassword(password, linkData.password);
      if (!isValid) {
        const passwordPage = getPasswordPage(shortKey, 'Invalid password');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(passwordPage);
        return;
      }
    }

    // 更新访问统计
    linkData.currentVisits++;
    linkData.totalVisits++;
    linkData.lastVisitAt = new Date().toISOString();
    linkData.updatedAt = new Date().toISOString();

    mockKV.set(shortKey, JSON.stringify(linkData));

    // 根据访问模式处理请求
    switch (linkData.accessMode) {
      case 'proxy': {
        // 代理模式 - 在简化服务器中返回提示页面
        const proxyPage = getProxyModePage(linkData.longUrl, linkData.title);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(proxyPage);
        break;
      }

      case 'iframe': {
        // iframe嵌入模式
        const iframePage = getIframePage(linkData.longUrl, linkData.title);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(iframePage);
        break;
      }

      case 'redirect':
      default: {
        // 传统HTTP重定向，保留目标URL的响应头
        try {
          // 获取目标URL的响应头
          const https = require('https');
          const http = require('http');
          const targetUrl = new URL(linkData.longUrl);
          const protocol = targetUrl.protocol === 'https:' ? https : http;

          const headRequest = protocol.request({
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: targetUrl.pathname + targetUrl.search,
            method: 'HEAD',
            headers: {
              'User-Agent': 'ClashMeta/1.18.0', // 服务器端访问原始链接时使用ClashMeta UA
              'Accept': req.headers['accept'] || '*/*'
            }
          }, (headRes) => {
            // 构建重定向响应头
            const redirectHeaders = { 'Location': linkData.longUrl };

            // 首先添加自定义响应头（优先级最高）
            if (linkData.customHeaders) {
              for (const [headerName, headerValue] of Object.entries(linkData.customHeaders)) {
                if (headerValue) {
                  redirectHeaders[headerName] = headerValue;
                }
              }
            }

            // 然后保留重要的响应头（如果自定义响应头中没有设置）
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
              // 只有在自定义响应头中没有设置时才从目标URL获取
              if (!redirectHeaders[headerName]) {
                const headerValue = headRes.headers[headerName.toLowerCase()];
                if (headerValue) {
                  redirectHeaders[headerName] = headerValue;
                }
              }
            }

            res.writeHead(302, redirectHeaders);
            res.end();
          });

          headRequest.on('error', (error) => {
            console.error('Error fetching target headers:', error);
            // 如果获取响应头失败，仍然进行重定向
            res.writeHead(302, { 'Location': linkData.longUrl });
            res.end();
          });

          headRequest.setTimeout(5000, () => {
            headRequest.destroy();
            // 超时时直接重定向
            res.writeHead(302, { 'Location': linkData.longUrl });
            res.end();
          });

          headRequest.end();

        } catch (error) {
          console.error('Error in redirect handling:', error);
          // 出错时直接重定向
          res.writeHead(302, { 'Location': linkData.longUrl });
          res.end();
        }
        break;
      }
    }

  } catch (error) {
    console.error('Short link error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error');
  }
}

// 工具函数
function generateRandomKey(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 密码哈希函数（简化版本）
async function hashPassword(password, salt = null) {
  if (!salt) {
    salt = generateRandomKey(16);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return `${salt}:${hashHex}`;
}

// 密码验证函数
async function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const newHash = await hashPassword(password, salt);
  return newHash === hashedPassword;
}

// 生成代理模式提示页面（简化服务器不支持真正的代理）
function getProxyModePage(targetUrl, title = '') {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title ? title + ' - ' : ''}代理访问 - MyUrls</title>
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
        <div class="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path>
            </svg>
        </div>
        <h2 class="text-2xl font-bold text-white mb-4">代理访问模式</h2>
        <p class="text-white opacity-75 mb-6">此链接使用代理访问模式，可完全隐藏目标URL</p>
        <div class="text-white opacity-50 text-sm mb-6">
            <p>⚠️ 简化开发服务器不支持真正的代理功能</p>
            <p>在生产环境中，目标URL将完全隐藏</p>
        </div>
        <div class="space-y-3">
            <button onclick="window.location.href='${targetUrl}'" class="w-full px-6 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-opacity-90 transition-all duration-200">
                继续访问目标页面
            </button>
            <button onclick="history.back()" class="w-full px-6 py-2 bg-white bg-opacity-20 text-white rounded-lg hover:bg-opacity-30 transition-all duration-200">
                返回
            </button>
        </div>
    </div>
</body>
</html>`;
}

// 生成iframe嵌入页面
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
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
    </style>
</head>
<body>
    <div class="loading" id="loading">正在加载...</div>
    <iframe src="${targetUrl}" onload="document.getElementById('loading').style.display='none'"></iframe>
</body>
</html>`;
}

// 生成安全重定向页面
function getSecureRedirectPage(targetUrl, title = '') {
  // 对URL进行Base64编码以避免在HTML源码中直接暴露
  const encodedUrl = Buffer.from(encodeURIComponent(targetUrl)).toString('base64');

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

// 处理管理后台页面
async function handleAdminPage(req, res) {
  // 简化版本：直接导入admin.js的处理逻辑
  try {
    // 创建兼容的Request对象
    const compatibleRequest = {
      url: `http://localhost:8789${req.url}`,
      method: req.method,
      headers: {
        get: (name) => req.headers[name.toLowerCase()],
        has: (name) => name.toLowerCase() in req.headers,
        entries: () => Object.entries(req.headers),
        forEach: (callback) => {
          for (const [key, value] of Object.entries(req.headers)) {
            callback(value, key);
          }
        }
      },
      json: async () => ({}),
      text: async () => '',
      formData: async () => new Map()
    };

    // 模拟Cloudflare Workers的context对象
    const context = {
      request: compatibleRequest,
      env: mockEnv
    };

    // 动态导入admin.js模块
    const adminModule = await import('./functions/admin.js');
    const response = await adminModule.onRequest(context);

    // 处理响应
    if (response.headers) {
      for (const [key, value] of response.headers.entries()) {
        res.setHeader(key, value);
      }
    }

    res.writeHead(response.status || 200);

    if (response.body) {
      res.end(response.body);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Admin page error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal Server Error');
  }
}

// 生成密码输入页面
function getPasswordPage(shortKey, error = '') {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>密码保护 - MyUrls</title>
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
    <div class="glass-effect rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div class="text-center mb-6">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
                <svg class="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                </svg>
            </div>
            <h2 class="text-2xl font-bold text-white mb-2">此链接需要密码访问</h2>
            <p class="text-white opacity-75">请输入正确的访问密码</p>
        </div>

        ${error ? `<div class="bg-red-500 bg-opacity-20 border border-red-300 text-red-100 px-4 py-3 rounded-lg mb-4 text-center">${error}</div>` : ''}

        <form method="get" class="space-y-4">
            <div>
                <label for="password" class="block text-white text-sm font-medium mb-2">访问密码</label>
                <input
                    type="password"
                    id="password"
                    name="password"
                    required
                    class="w-full px-4 py-3 bg-white bg-opacity-90 border border-white border-opacity-30 rounded-lg focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 focus:bg-opacity-100 transition-all duration-200"
                    placeholder="请输入密码"
                    autofocus
                >
            </div>
            <button
                type="submit"
                class="w-full px-4 py-3 bg-white text-blue-600 font-semibold rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50 transition-all duration-200"
            >
                访问链接
            </button>
        </form>

        <div class="text-center mt-6">
            <a href="/" class="text-white opacity-75 hover:opacity-100 text-sm transition-opacity duration-200">
                返回首页
            </a>
        </div>
    </div>
</body>
</html>`;
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 获取请求体
  let body = '';
  if (req.method === 'POST' || req.method === 'PUT') {
    await new Promise((resolve) => {
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', resolve);
    });
  }

  // 路由处理
  if (pathname === '/') {
    serveStaticFile(path.join(__dirname, 'index.html'), res);
  } else if (pathname === '/admin') {
    // 管理后台页面 - 需要特殊处理，避免被当作短链接
    await handleAdminPage(req, res);
  } else if (pathname.startsWith('/api/')) {
    await handleAPI(pathname, req.method, body, res, req);
  } else if (pathname.match(/^\/[a-zA-Z0-9_-]+$/)) {
    const shortKey = pathname.substring(1);
    await handleShortLink(shortKey, parsedUrl.query, res, req);
  } else {
    // 静态文件
    const filePath = path.join(__dirname, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveStaticFile(filePath, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
});

const PORT = 8789;

server.listen(PORT, () => {
  console.log('🚀 MyUrls 简化开发服务器已启动！');
  console.log(`📍 服务器地址: http://localhost:${PORT}`);
  console.log(`🔑 管理员密码: ${mockEnv.ADMIN_PASSWORD}`);
  console.log('');
  console.log('💡 提示：');
  console.log('- 这是一个简化的本地开发环境');
  console.log('- 数据存储在内存中，重启后会丢失');
  console.log('- 支持基本的短链接创建和访问次数限制功能');
  console.log('- 按 Ctrl+C 停止服务器');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
