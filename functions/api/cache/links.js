// 缓存管理API
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  unauthorizedResponse 
} from '../../utils/response.js';
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

  // 检查认证
  const auth = await authMiddleware(request, env, kv);
  if (!auth || !auth.isAuthenticated) {
    return unauthorizedResponse('Authentication required');
  }

  switch (request.method) {
    case 'DELETE':
      return await clearLinksCache(kv);
    case 'GET':
      return await getCacheStatus(kv);
    default:
      return errorResponse('Method not allowed', 405, 405);
  }
}

/**
 * 清除链接缓存
 */
async function clearLinksCache(kv) {
  try {
    // 清除链接索引缓存
    await kv.delete('links:index');
    
    // 清除其他相关缓存
    const { keys } = await kv.list({ prefix: 'cache:' });
    for (const key of keys) {
      await kv.delete(key.name);
    }

    console.log('All links cache cleared');
    return successResponse(null, 'Cache cleared successfully');
  } catch (error) {
    console.error('Clear cache error:', error);
    return errorResponse('Failed to clear cache', 500, 500);
  }
}

/**
 * 获取缓存状态
 */
async function getCacheStatus(kv) {
  try {
    const cacheStatus = {
      linksIndex: null,
      cacheKeys: []
    };

    // 检查链接索引缓存
    try {
      const indexCache = await kv.get('links:index');
      if (indexCache) {
        const parsed = JSON.parse(indexCache);
        cacheStatus.linksIndex = {
          exists: true,
          timestamp: parsed.timestamp,
          count: parsed.count,
          age: Date.now() - parsed.timestamp
        };
      } else {
        cacheStatus.linksIndex = { exists: false };
      }
    } catch (e) {
      cacheStatus.linksIndex = { exists: false, error: e.message };
    }

    // 获取所有缓存键
    const { keys } = await kv.list({ prefix: 'cache:' });
    cacheStatus.cacheKeys = keys.map(key => key.name);

    return successResponse(cacheStatus);
  } catch (error) {
    console.error('Get cache status error:', error);
    return errorResponse('Failed to get cache status', 500, 500);
  }
}
