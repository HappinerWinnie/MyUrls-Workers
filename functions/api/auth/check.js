// 检查登录状态API
import { successResponse, unauthorizedResponse, optionsResponse, errorResponse } from '../../utils/response.js';
import { authMiddleware } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 只允许GET请求
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405, 405);
  }

  // 检查D1数据库
  if (!db) {
    return errorResponse('Database not configured', 500, 500);
  }

  try {
    // 检查认证
    const auth = await authMiddleware(request, env, db);

    if (!auth || !auth.isAuthenticated) {
      return unauthorizedResponse('Not authenticated');
    }

    // 返回用户信息
    return successResponse({
      user: {
        id: auth.userId,
        role: 'admin',
        sessionId: auth.sessionId
      },
      isAuthenticated: true
    }, 'Authenticated');

  } catch (error) {
    console.error('Auth check error:', error);
    return errorResponse('Authentication check failed', 500, 500);
  }
}
