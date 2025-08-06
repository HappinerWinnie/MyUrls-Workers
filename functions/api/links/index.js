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
      customHeaders: data.customHeaders || {}, // 自定义响应头
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

    // 清除链接索引缓存
    await invalidateLinksCache(kv);

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
 * 获取链接列表（需要认证）- 性能优化版本
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
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';

    // 尝试从缓存获取链接索引
    const cacheKey = 'links:index';
    let linksIndex = null;

    try {
      const cachedIndex = await kv.get(cacheKey);
      if (cachedIndex) {
        linksIndex = JSON.parse(cachedIndex);
        // 检查缓存是否过期（5分钟）
        if (Date.now() - linksIndex.timestamp < 5 * 60 * 1000) {
          console.log('Using cached links index');
        } else {
          linksIndex = null;
        }
      }
    } catch (e) {
      console.log('Cache miss or error, rebuilding index');
    }

    // 如果没有缓存或缓存过期，重建索引
    if (!linksIndex) {
      linksIndex = await buildLinksIndex(kv);
      // 异步更新缓存，不阻塞响应
      updateLinksIndexCache(kv, cacheKey, linksIndex).catch(console.error);
    }

    // 过滤搜索结果
    let filteredLinks = linksIndex.links;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredLinks = linksIndex.links.filter(link =>
        link.shortKey.toLowerCase().includes(searchLower) ||
        link.longUrl.toLowerCase().includes(searchLower) ||
        (link.title && link.title.toLowerCase().includes(searchLower)) ||
        (link.description && link.description.toLowerCase().includes(searchLower)) ||
        (link.tags && link.tags.some(tag => tag.toLowerCase().includes(searchLower)))
      );
    }

    // 排序
    filteredLinks.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      // 处理日期字段
      if (sortBy === 'createdAt' || sortBy === 'updatedAt' || sortBy === 'lastVisitAt') {
        aValue = aValue ? new Date(aValue) : new Date(0);
        bValue = bValue ? new Date(bValue) : new Date(0);
      }

      // 处理数字字段
      if (sortBy === 'currentVisits' || sortBy === 'totalVisits' || sortBy === 'maxVisits') {
        aValue = aValue || 0;
        bValue = bValue || 0;
      }

      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : bValue < aValue ? -1 : 0;
      } else {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      }
    });

    // 分页
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedLinks = filteredLinks.slice(startIndex, endIndex);

    // 如果需要完整数据，批量获取
    const detailedLinks = await batchGetLinkDetails(kv, paginatedLinks);

    return successResponse({
      links: detailedLinks,
      pagination: {
        page,
        limit,
        total: filteredLinks.length,
        totalPages: Math.ceil(filteredLinks.length / limit)
      },
      meta: {
        sortBy,
        sortOrder,
        search,
        cacheUsed: !!linksIndex,
        totalLinksInSystem: linksIndex.links.length
      }
    });

  } catch (error) {
    console.error('Get links error:', error);
    return errorResponse('Failed to get links', 500, 500);
  }
}

/**
 * 构建链接索引 - 只获取必要的元数据
 */
async function buildLinksIndex(kv) {
  console.log('Building links index...');
  const startTime = Date.now();

  // 获取所有键
  const { keys } = await kv.list({ limit: 1000 });
  const linkKeys = keys.filter(key =>
    !key.name.startsWith('session:') &&
    !key.name.startsWith('stats:') &&
    !key.name.startsWith('links:') &&
    !key.name.startsWith('cache:')
  );

  // 并行获取链接数据，但只提取索引需要的字段
  const batchSize = 50; // 控制并发数量
  const links = [];

  for (let i = 0; i < linkKeys.length; i += batchSize) {
    const batch = linkKeys.slice(i, i + batchSize);
    const batchPromises = batch.map(async (key) => {
      try {
        const linkData = await kv.get(key.name);
        if (linkData) {
          const link = JSON.parse(linkData);
          // 只返回索引需要的字段，减少内存使用
          return {
            shortKey: link.shortKey,
            longUrl: link.longUrl,
            title: link.title || '',
            description: link.description || '',
            tags: link.tags || [],
            createdAt: link.createdAt,
            updatedAt: link.updatedAt,
            lastVisitAt: link.lastVisitAt,
            currentVisits: link.currentVisits || 0,
            totalVisits: link.totalVisits || 0,
            maxVisits: link.maxVisits || -1,
            isActive: link.isActive !== false,
            hasPassword: !!link.password,
            accessMode: link.accessMode || 'redirect',
            expiresAt: link.expiresAt
          };
        }
      } catch (e) {
        console.error(`Error parsing link ${key.name}:`, e);
      }
      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    links.push(...batchResults.filter(Boolean));
  }

  const endTime = Date.now();
  console.log(`Built index for ${links.length} links in ${endTime - startTime}ms`);

  return {
    links,
    timestamp: Date.now(),
    count: links.length
  };
}

/**
 * 异步更新链接索引缓存
 */
async function updateLinksIndexCache(kv, cacheKey, linksIndex) {
  try {
    await kv.put(cacheKey, JSON.stringify(linksIndex), {
      expirationTtl: 600 // 10分钟过期
    });
    console.log('Links index cache updated');
  } catch (error) {
    console.error('Failed to update links index cache:', error);
  }
}

/**
 * 批量获取链接详细信息
 */
async function batchGetLinkDetails(kv, indexLinks) {
  const batchSize = 20;
  const detailedLinks = [];

  for (let i = 0; i < indexLinks.length; i += batchSize) {
    const batch = indexLinks.slice(i, i + batchSize);
    const batchPromises = batch.map(async (indexLink) => {
      try {
        // 如果索引中已有足够信息，直接返回
        if (indexLink.shortKey && indexLink.longUrl) {
          return {
            id: indexLink.id || indexLink.shortKey,
            shortKey: indexLink.shortKey,
            longUrl: indexLink.longUrl,
            title: indexLink.title,
            description: indexLink.description,
            maxVisits: indexLink.maxVisits,
            currentVisits: indexLink.currentVisits,
            totalVisits: indexLink.totalVisits,
            expiresAt: indexLink.expiresAt,
            accessMode: indexLink.accessMode,
            tags: indexLink.tags,
            isActive: indexLink.isActive,
            createdAt: indexLink.createdAt,
            updatedAt: indexLink.updatedAt,
            lastVisitAt: indexLink.lastVisitAt,
            hasPassword: indexLink.hasPassword
          };
        }

        // 如果需要更多信息，从KV获取完整数据
        const linkData = await kv.get(indexLink.shortKey);
        if (linkData) {
          const link = JSON.parse(linkData);
          return {
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
          };
        }
      } catch (e) {
        console.error(`Error getting details for ${indexLink.shortKey}:`, e);
      }
      return null;
    });

    const batchResults = await Promise.all(batchPromises);
    detailedLinks.push(...batchResults.filter(Boolean));
  }

  return detailedLinks;
}

/**
 * 清除链接缓存
 */
async function invalidateLinksCache(kv) {
  try {
    await kv.delete('links:index');
    console.log('Links cache invalidated');
  } catch (error) {
    console.error('Failed to invalidate links cache:', error);
  }
}
