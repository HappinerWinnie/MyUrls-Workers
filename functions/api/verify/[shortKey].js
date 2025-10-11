// 密码验证API
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  notFoundResponse,
  forbiddenResponse 
} from '../../utils/response.js';
import { verifyPassword, isExpired } from '../../utils/crypto.js';
import { LinkDB } from '../../utils/database.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const shortKey = params.shortKey;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 只允许POST请求
  if (request.method !== 'POST') {
    return errorResponse('Method not allowed', 405, 405);
  }

  // 检查数据库配置
  if (!db) {
    return errorResponse('Database not configured', 500, 500);
  }

  if (!shortKey) {
    return errorResponse('Short key is required', 400);
  }

  try {
    // 创建数据库实例
    const linkDB = new LinkDB(db);
    
    // 获取链接数据
    const linkData = await linkDB.getLinkByShortKey(shortKey);
    if (!linkData) {
      return notFoundResponse('Link not found');
    }

    // 检查链接是否激活
    if (!linkData.isActive) {
      return forbiddenResponse('This link has been disabled');
    }

    // 检查是否过期
    if (linkData.expiresAt && isExpired(linkData.expiresAt)) {
      return forbiddenResponse('This link has expired');
    }

    // 检查访问次数限制
    if (linkData.maxVisits > 0 && linkData.currentVisits >= linkData.maxVisits) {
      return forbiddenResponse('This link has reached its visit limit');
    }

    // 检查是否需要密码
    if (!linkData.password) {
      return errorResponse('This link does not require a password', 400);
    }

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

    // 验证密码
    const isValid = await verifyPassword(password, linkData.password);
    if (!isValid) {
      return errorResponse('Invalid password', 401, 401);
    }

    // 密码正确，返回成功响应
    return successResponse({
      shortKey: linkData.shortKey,
      longUrl: linkData.longUrl,
      title: linkData.title,
      verified: true
    }, 'Password verified successfully');

  } catch (error) {
    console.error('Password verification error:', error);
    return errorResponse('Password verification failed', 500, 500);
  }
}
