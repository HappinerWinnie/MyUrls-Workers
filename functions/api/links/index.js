// 链接管理API - 创建和列表
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

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.LINKS;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 检查KV存储
  if (!kv) {
    return errorResponse('KV storage not configured', 500, 500);
  }

  // 检查认证（对于管理功能）
  const auth = await authMiddleware(request, env, kv);
  const isAuthenticated = auth && auth.isAuthenticated;

  if (request.method === 'POST') {
    return await createLink(request, kv, isAuthenticated);
  } else if (request.method === 'GET') {
    return await getLinks(request, kv, isAuthenticated);
  } else {
    return errorResponse('Method not allowed', 405, 405);
  }
}

/**
 * 创建短链接
 */
async function createLink(request, kv, isAuthenticated) {
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
        expiryDays: formData.get('expiryDays'),
        accessMode: formData.get('accessMode'),
        tags: formData.get('tags')
      };
    }

    // 验证必需字段
    if (!data.longUrl) {
      return errorResponse('Long URL is required', 400);
    }

    // 处理Base64编码的URL（兼容旧版本）
    let longUrl = data.longUrl;
    try {
      // 尝试Base64解码
      const decoded = atob(longUrl);
      if (isValidUrl(decoded)) {
        longUrl = decoded;
      }
    } catch {
      // 如果解码失败，使用原始URL
    }

    // 验证和清理URL
    longUrl = sanitizeUrl(longUrl);
    if (!isValidUrl(longUrl)) {
      return errorResponse('Invalid URL format', 400);
    }

    // 生成或验证短链接key
    let shortKey = data.shortKey;
    if (shortKey) {
      // 检查自定义key是否已存在
      const existing = await kv.get(shortKey);
      if (existing) {
        return errorResponse(`Short key "${shortKey}" already exists`, 409);
      }
    } else {
      // 生成随机key
      do {
        shortKey = generateRandomKey(6);
      } while (await kv.get(shortKey));
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

    // 处理访问次数限制
    let maxVisits = -1; // 默认无限制
    if (data.maxVisits && parseInt(data.maxVisits) > 0) {
      maxVisits = parseInt(data.maxVisits);
    }

    // 处理标签
    let tags = [];
    if (data.tags) {
      if (Array.isArray(data.tags)) {
        tags = data.tags;
      } else if (typeof data.tags === 'string') {
        tags = data.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    // 创建链接对象
    const linkData = {
      id: generateUUID(),
      longUrl,
      shortKey,
      title: data.title || '',
      description: data.description || '',
      password: hashedPassword,
      maxVisits,
      currentVisits: 0,
      expiresAt,
      accessMode: data.accessMode || 'redirect',
      secureMode: data.secureMode !== false, // 默认启用安全模式
      createdAt: getCurrentTimestamp(),
      updatedAt: getCurrentTimestamp(),
      createdBy: isAuthenticated ? 'admin' : 'anonymous',
      tags,
      isActive: true,
      totalVisits: 0,
      lastVisitAt: null,
      visitHistory: []
    };

    // 保存到KV存储
    await kv.put(shortKey, JSON.stringify(linkData));

    // 构建短链接URL
    const shortUrl = `https://${request.headers.get('host')}/${shortKey}`;

    return successResponse({
      id: linkData.id,
      shortUrl,
      shortKey,
      longUrl,
      title: linkData.title,
      description: linkData.description,
      maxVisits: linkData.maxVisits,
      expiresAt: linkData.expiresAt,
      accessMode: linkData.accessMode,
      tags: linkData.tags,
      createdAt: linkData.createdAt
    }, 'Link created successfully');

  } catch (error) {
    console.error('Create link error:', error);
    return errorResponse('Failed to create link', 500, 500);
  }
}

/**
 * 获取链接列表（需要认证）
 */
async function getLinks(request, kv, isAuthenticated) {
  if (!isAuthenticated) {
    return unauthorizedResponse('Authentication required');
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page')) || 1;
    const limit = Math.min(parseInt(url.searchParams.get('limit')) || 20, 100);
    const search = url.searchParams.get('search') || '';

    // 获取所有链接（这里简化处理，实际应该使用分页）
    const { keys } = await kv.list({ limit: 1000 });
    const links = [];

    for (const key of keys) {
      if (key.name.startsWith('session:') || key.name.startsWith('stats:')) {
        continue;
      }

      const linkData = await kv.get(key.name);
      if (linkData) {
        try {
          const link = JSON.parse(linkData);
          
          // 搜索过滤
          if (search) {
            const searchLower = search.toLowerCase();
            const matchesSearch = 
              link.shortKey.toLowerCase().includes(searchLower) ||
              link.longUrl.toLowerCase().includes(searchLower) ||
              (link.title && link.title.toLowerCase().includes(searchLower)) ||
              (link.description && link.description.toLowerCase().includes(searchLower));
            
            if (!matchesSearch) {
              continue;
            }
          }

          links.push({
            id: link.id,
            shortKey: link.shortKey,
            longUrl: link.longUrl,
            title: link.title,
            description: link.description,
            maxVisits: link.maxVisits,
            currentVisits: link.currentVisits,
            totalVisits: link.totalVisits,
            expiresAt: link.expiresAt,
            accessMode: link.accessMode,
            tags: link.tags,
            isActive: link.isActive,
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
            lastVisitAt: link.lastVisitAt,
            hasPassword: !!link.password
          });
        } catch (e) {
          console.error('Error parsing link data:', e);
        }
      }
    }

    // 排序（按创建时间倒序）
    links.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLinks = links.slice(startIndex, endIndex);

    return successResponse({
      links: paginatedLinks,
      pagination: {
        page,
        limit,
        total: links.length,
        totalPages: Math.ceil(links.length / limit)
      }
    });

  } catch (error) {
    console.error('Get links error:', error);
    return errorResponse('Failed to get links', 500, 500);
  }
}
