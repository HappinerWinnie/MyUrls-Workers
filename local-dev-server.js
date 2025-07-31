// 本地开发服务器 - 模拟 Cloudflare Pages Functions 环境
import http from 'http';
import fs from 'fs';
import path from 'path';
import url from 'url';

// 获取当前文件的目录路径（ES 模块中的 __dirname 替代）
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 简单的 Request/Response polyfill
global.Request = class Request {
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
};

global.Response = class Response {
  constructor(body, init = {}) {
    this._body = body;
    this.status = init.status || 200;
    this.headers = new Map(Object.entries(init.headers || {}));
  }

  get body() {
    // 简单的 ReadableStream 模拟
    if (this._body === null || this._body === undefined) {
      return null;
    }

    return {
      getReader: () => ({
        read: async () => {
          if (this._bodyRead) {
            return { done: true };
          }
          this._bodyRead = true;
          const encoder = new TextEncoder();
          const chunk = typeof this._body === 'string'
            ? encoder.encode(this._body)
            : this._body;
          return { done: false, value: chunk };
        }
      })
    };
  }

  async text() {
    return this._body ? this._body.toString() : '';
  }

  async json() {
    return JSON.parse(this._body);
  }

  static redirect(url, status = 302) {
    return new Response(null, {
      status,
      headers: { Location: url }
    });
  }
};

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

// 获取文件的 MIME 类型
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return mimeTypes[ext] || 'application/octet-stream';
}

// 读取静态文件
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

// 动态导入 ES 模块
async function importFunction(functionPath) {
  try {
    // 转换为 file:// URL（Windows 兼容）
    const fileUrl = `file://${functionPath.replace(/\\/g, '/')}?t=${Date.now()}`;
    const module = await import(fileUrl);
    return module;
  } catch (error) {
    console.error(`Error importing ${functionPath}:`, error);
    return null;
  }
}

// 处理 Functions 请求
async function handleFunction(functionPath, request, res, params = {}) {
  try {
    const module = await importFunction(functionPath);
    if (!module || !module.onRequest) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Function not found');
      return;
    }

    const context = {
      request,
      env: mockEnv,
      params
    };

    const response = await module.onRequest(context);
    
    // 处理 Response 对象
    if (response instanceof Response) {
      const headers = {};
      for (const [key, value] of response.headers.entries()) {
        headers[key] = value;
      }

      res.writeHead(response.status, headers);

      if (response._body !== null && response._body !== undefined) {
        if (typeof response._body === 'string') {
          res.end(response._body);
        } else if (response._body instanceof Buffer) {
          res.end(response._body);
        } else {
          res.end(JSON.stringify(response._body));
        }
      } else {
        res.end();
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Invalid response from function');
    }
  } catch (error) {
    console.error('Function execution error:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Internal server error', details: error.message }));
  }
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`${req.method} ${pathname}`);

  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');

  // 创建标准的 Request 对象
  let body = '';
  if (req.method === 'POST' || req.method === 'PUT') {
    await new Promise((resolve) => {
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', resolve);
    });
  }

  const requestUrl = `http://localhost:${PORT}${req.url}`;
  const requestInit = {
    method: req.method,
    headers: req.headers,
    body: body || undefined
  };

  const request = new Request(requestUrl, requestInit);

  // 处理 OPTIONS 请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 路由处理
  if (pathname === '/') {
    // 主页
    serveStaticFile(path.join(__dirname, 'index.html'), res);
  } else if (pathname === '/admin') {
    // 管理后台
    const functionPath = path.join(__dirname, 'functions', 'admin.js');
    await handleFunction(functionPath, request, res);
  } else if (pathname === '/short') {
    // 兼容旧版本 API
    const functionPath = path.join(__dirname, 'functions', 'short.js');
    await handleFunction(functionPath, request, res);
  } else if (pathname.startsWith('/api/')) {
    // API 路由
    const apiPath = pathname.substring(4); // 移除 '/api'
    let functionPath;

    // 处理不同的 API 路径
    if (apiPath === '/links') {
      functionPath = path.join(__dirname, 'functions', 'api', 'links', 'index.js');
    } else if (apiPath.startsWith('/links/')) {
      const shortKey = apiPath.substring(7); // 移除 '/links/'
      if (shortKey === 'batch') {
        functionPath = path.join(__dirname, 'functions', 'api', 'links', 'batch.js');
      } else {
        functionPath = path.join(__dirname, 'functions', 'api', 'links', '[shortKey].js');
        await handleFunction(functionPath, req, res, { shortKey });
        return;
      }
    } else if (apiPath.startsWith('/auth/')) {
      const authAction = apiPath.substring(6); // 移除 '/auth/'
      functionPath = path.join(__dirname, 'functions', 'api', 'auth', `${authAction}.js`);
    } else if (apiPath.startsWith('/stats/')) {
      const statsPath = apiPath.substring(7); // 移除 '/stats/'
      if (statsPath === 'overview') {
        functionPath = path.join(__dirname, 'functions', 'api', 'stats', 'overview.js');
      } else {
        functionPath = path.join(__dirname, 'functions', 'api', 'stats', '[shortKey].js');
        await handleFunction(functionPath, req, res, { shortKey: statsPath });
        return;
      }
    } else if (apiPath.startsWith('/verify/')) {
      const shortKey = apiPath.substring(8); // 移除 '/verify/'
      functionPath = path.join(__dirname, 'functions', 'api', 'verify', '[shortKey].js');
      await handleFunction(functionPath, req, res, { shortKey });
      return;
    } else {
      functionPath = path.join(__dirname, 'functions', 'api', `${apiPath}.js`);
    }

    if (fs.existsSync(functionPath)) {
      await handleFunction(functionPath, request, res);
    } else {
      console.log(`API endpoint not found: ${functionPath}`);
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API endpoint not found', path: apiPath }));
    }
  } else if (pathname.match(/^\/[a-zA-Z0-9]+$/)) {
    // 短链接访问
    const shortKey = pathname.substring(1);
    const functionPath = path.join(__dirname, 'functions', '[shortKey].js');
    await handleFunction(functionPath, request, res, { shortKey });
  } else {
    // 静态文件或 404
    const filePath = path.join(__dirname, pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      serveStaticFile(filePath, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  }
});

const PORT = process.env.PORT || 8788;

server.listen(PORT, () => {
  console.log('🚀 MyUrls 本地开发服务器已启动！');
  console.log(`📍 服务器地址: http://localhost:${PORT}`);
  console.log(`🔧 管理后台: http://localhost:${PORT}/admin`);
  console.log(`🔑 管理员密码: ${mockEnv.ADMIN_PASSWORD}`);
  console.log('');
  console.log('💡 提示：');
  console.log('- 这是一个模拟的本地开发环境');
  console.log('- 数据存储在内存中，重启后会丢失');
  console.log('- 按 Ctrl+C 停止服务器');
  console.log('');
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n👋 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});
