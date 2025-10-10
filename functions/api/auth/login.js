// 管理员登录API
import { jsonResponse, errorResponse, successResponse, optionsResponse } from '../../utils/response.js';
import { checkAdminPassword, createSessionD1, setSessionCookie } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 只允许POST请求
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 405);
  }

  // 检查D1数据库
  if (!db) {
    return errorResponse('Database not configured', 500, 500);
  }

  try {
    // 解析请求数据
    const contentType = request.headers.get('Content-Type');
    let password;

    if (contentType && contentType.includes('application/json')) {
      const data = await request.json();
      password = data.password;
    } else {
      const formData = await request.formData();
      password = formData.get('password');
    }

    if (!password) {
      return errorResponse('Password is required', 400);
    }

    // 获取管理员密码（从环境变量）
    const adminPassword = env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return errorResponse('Admin password not configured', 500, 500);
    }

    // 验证密码
    if (!checkAdminPassword(password, adminPassword)) {
      return errorResponse('Invalid password', 401, 401);
    }

    // 创建会话
    const sessionToken = await createSessionD1(db, 'admin');

    // 返回成功响应，设置Cookie
    const response = successResponse({
      sessionToken,
      user: {
        id: 'admin',
        role: 'admin'
      }
    }, 'Login successful');

    // 设置会话Cookie
    response.headers.set('Set-Cookie', setSessionCookie(sessionToken));

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return errorResponse('Login failed', 500, 500);
  }
}
