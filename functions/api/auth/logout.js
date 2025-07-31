// 管理员登出API
import { successResponse, optionsResponse, errorResponse } from '../../utils/response.js';
import { getSessionTokenFromRequest, destroySession, clearSessionCookie } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.LINKS;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 只允许POST请求
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 405);
  }

  // 检查KV存储
  if (!kv) {
    return errorResponse('KV storage not configured', 500, 500);
  }

  try {
    // 获取会话令牌
    const sessionToken = getSessionTokenFromRequest(request);

    // 销毁会话
    if (sessionToken) {
      await destroySession(kv, sessionToken);
    }

    // 返回成功响应，清除Cookie
    const response = successResponse(null, 'Logout successful');
    response.headers.set('Set-Cookie', clearSessionCookie());

    return response;

  } catch (error) {
    console.error('Logout error:', error);
    return errorResponse('Logout failed', 500, 500);
  }
}
