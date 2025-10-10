// 链接管理API - 使用D1数据库
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  unauthorizedResponse 
} from '../../utils/response.js';
import { 
  generateRandomKey, 
  generateUUID, 
  isValidUrl, 
  sanitizeUrl, 
  getCurrentTimestamp,
  hashPassword 
} from '../../utils/crypto.js';
import { authMiddleware } from '../../utils/auth.js';
import { LinkDB } from '../../utils/database.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    // 处理OPTIONS预检请求
    if (request.method === 'OPTIONS') {
      return optionsResponse();
    }

    // 检查认证
    const auth = await authMiddleware(request, env, db);
    const isAuthenticated = auth && auth.isAuthenticated;

    if (request.method === 'POST') {
      return await createLink(request, db, isAuthenticated);
    } else if (request.method === 'GET') {
      return await getLinks(request, db, isAuthenticated);
    } else {
      return errorResponse('Method not allowed', 405, 405);
    }
  } catch (error) {
    console.error('API request error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      method: request.method,
      url: request.url,
      error: error
    });
    return errorResponse(`API error: ${error.message}`, 500);
  }
}

/**
 * 创建短链接
 */
async function createLink(request, db, isAuthenticated) {
  const linkDB = new LinkDB(db);
  
  try {
    // 解析请求数据
    const contentType = request.headers.get('Content-Type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await request.json();
    } else {
      const formData = await request.formData();
      data = {
        longUrl: formData.get('longUrl'),
        shortKey: formData.get('shortKey'),
        title: formData.get('title'),
        description: formData.get('description'),
        password: formData.get('password'),
        maxVisits: formData.get('maxVisits'),
        maxDevices: formData.get('maxDevices'),
        visitLimitMode: formData.get('visitLimitMode'),
        expiryDays: formData.get('expiryDays'),
        accessMode: formData.get('accessMode'),
        tags: formData.get('tags') ? formData.get('tags').split(',').map(t => t.trim()) : []
      };
    }

    // 验证必需字段
    if (!data.longUrl) {
      return errorResponse('Long URL is required', 400);
    }

    // 验证URL格式
    if (!isValidUrl(data.longUrl)) {
      return errorResponse('Invalid URL format', 400);
    }

    // 清理URL
    const cleanUrl = sanitizeUrl(data.longUrl);

    // 处理短键
    let shortKey = data.shortKey;
    if (shortKey) {
      // 检查自定义短键是否已存在
      const existing = await linkDB.getLinkByShortKey(shortKey);
      if (existing) {
        return errorResponse(`Short key "${shortKey}" already exists`, 409);
      }
    } else {
      // 生成随机key
      do {
        shortKey = generateRandomKey(6);
      } while (await linkDB.getLinkByShortKey(shortKey));
    }

    // 处理密码
    let hashedPassword = null;
    if (data.password) {
      hashedPassword = await hashPassword(data.password);
    }

    // 处理过期时间
    let expiresAt = null;
    if (data.expiryDays && parseInt(data.expiryDays) > 0) {
      const days = parseInt(data.expiryDays);
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    }

    // 构建链接数据
    const linkData = {
      shortKey,
      longUrl: cleanUrl,
      title: data.title || '',
      description: data.description || '',
      passwordHash: hashedPassword,
      maxVisits: data.maxVisits ? parseInt(data.maxVisits) : -1,
      maxDevices: data.maxDevices ? parseInt(data.maxDevices) : null,
      visitLimitMode: data.visitLimitMode || 'devices',
      expiresAt,
      accessMode: data.accessMode || 'redirect',
      secureMode: data.secureMode !== false,
      createdBy: isAuthenticated ? 'admin' : 'anonymous',
      customHeaders: data.customHeaders || {},
      tags: data.tags || [],
      riskControl: {
        visitLimits: data.visitLimits || {},
        uaFilter: data.uaFilter || {},
        riskAlert: data.riskAlert || {},
        countryRestriction: data.countryRestriction || {}
      }
    };

    // 创建链接
    const result = await linkDB.createLink(linkData);
    
    if (result.success) {
      // 构建响应数据
      const responseData = {
        id: result.meta.last_row_id,
        shortKey,
        shortUrl: `${new URL(request.url).origin}/${shortKey}`,
        longUrl: cleanUrl,
        title: linkData.title,
        description: linkData.description,
        maxVisits: linkData.maxVisits,
        maxDevices: linkData.maxDevices,
        visitLimitMode: linkData.visitLimitMode,
        expiresAt: linkData.expiresAt,
        accessMode: linkData.accessMode,
        createdAt: getCurrentTimestamp(),
        createdBy: linkData.createdBy
      };

      return successResponse(responseData, 'Link created successfully');
    } else {
      return errorResponse('Failed to create link', 500);
    }

  } catch (error) {
    console.error('Create link error:', error);
    return errorResponse('Internal server error', 500);
  }
}

/**
 * 获取链接列表
 */
async function getLinks(request, db, isAuthenticated) {
  const linkDB = new LinkDB(db);
  
  try {
    // 解析查询参数
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const page = parseInt(url.searchParams.get('page')) || 1;
    const offset = (page - 1) * limit;
    const search = url.searchParams.get('search') || '';
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    console.log('getLinks parameters:', { limit, page, offset, search, sortBy, sortOrder });

    // 获取链接列表
    let links;
    if (search) {
      // 搜索功能
      links = await linkDB.searchLinks(search, limit, offset, sortBy, sortOrder);
    } else {
      links = await linkDB.getAllLinks(limit, offset, sortBy, sortOrder);
    }

    // 获取统计信息
    const stats = await linkDB.getStats();

    return successResponse({
      links,
      stats,
      pagination: {
        limit,
        offset,
        total: stats.totalLinks
      }
    });

  } catch (error) {
    console.error('Get links error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      url: request.url,
      error: error
    });
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}
