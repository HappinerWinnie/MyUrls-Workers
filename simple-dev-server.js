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
async function handleAPI(pathname, method, body, res) {
  try {
    let result;
    
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
          maxVisits: data.maxVisits || -1,
          currentVisits: 0,
          expiresAt: data.expiryDays ? new Date(Date.now() + data.expiryDays * 24 * 60 * 60 * 1000).toISOString() : null,
          accessMode: 'redirect',
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
async function handleShortLink(shortKey, res) {
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
    
    // 更新访问统计
    linkData.currentVisits++;
    linkData.totalVisits++;
    linkData.lastVisitAt = new Date().toISOString();
    linkData.updatedAt = new Date().toISOString();
    
    mockKV.set(shortKey, JSON.stringify(linkData));
    
    // 重定向到目标URL
    res.writeHead(302, { 'Location': linkData.longUrl });
    res.end();
    
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
  } else if (pathname.startsWith('/api/')) {
    await handleAPI(pathname, req.method, body, res);
  } else if (pathname.match(/^\/[a-zA-Z0-9]+$/)) {
    const shortKey = pathname.substring(1);
    await handleShortLink(shortKey, res);
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

const PORT = 8788;

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
