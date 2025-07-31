// 批量操作API
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  unauthorizedResponse 
} from '../../utils/response.js';
import { getCurrentTimestamp } from '../../utils/crypto.js';
import { authMiddleware } from '../../utils/auth.js';

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

  // 检查认证
  const auth = await authMiddleware(request, env, kv);
  if (!auth || !auth.isAuthenticated) {
    return unauthorizedResponse('Authentication required');
  }

  try {
    const contentType = request.headers.get('Content-Type');
    let data;

    if (contentType && contentType.includes('application/json')) {
      data = await request.json();
    } else {
      return errorResponse('Content-Type must be application/json', 400);
    }

    const { action, shortKeys } = data;

    if (!action || !Array.isArray(shortKeys) || shortKeys.length === 0) {
      return errorResponse('Action and shortKeys array are required', 400);
    }

    // 限制批量操作的数量
    if (shortKeys.length > 100) {
      return errorResponse('Maximum 100 links can be processed at once', 400);
    }

    let results = [];

    switch (action) {
      case 'delete':
        results = await batchDelete(kv, shortKeys);
        break;
      case 'enable':
        results = await batchUpdateStatus(kv, shortKeys, true);
        break;
      case 'disable':
        results = await batchUpdateStatus(kv, shortKeys, false);
        break;
      case 'export':
        results = await batchExport(kv, shortKeys);
        break;
      default:
        return errorResponse('Invalid action. Supported actions: delete, enable, disable, export', 400);
    }

    return successResponse({
      action,
      processed: results.length,
      results
    }, `Batch ${action} completed`);

  } catch (error) {
    console.error('Batch operation error:', error);
    return errorResponse('Batch operation failed', 500, 500);
  }
}

/**
 * 批量删除链接
 */
async function batchDelete(kv, shortKeys) {
  const results = [];

  for (const shortKey of shortKeys) {
    try {
      const linkDataStr = await kv.get(shortKey);
      if (linkDataStr) {
        // 删除链接数据
        await kv.delete(shortKey);
        
        // 删除相关的统计数据
        const { keys } = await kv.list({ prefix: `stats:${shortKey}:` });
        for (const key of keys) {
          await kv.delete(key.name);
        }

        results.push({
          shortKey,
          success: true,
          message: 'Deleted successfully'
        });
      } else {
        results.push({
          shortKey,
          success: false,
          message: 'Link not found'
        });
      }
    } catch (error) {
      results.push({
        shortKey,
        success: false,
        message: 'Delete failed: ' + error.message
      });
    }
  }

  return results;
}

/**
 * 批量更新链接状态
 */
async function batchUpdateStatus(kv, shortKeys, isActive) {
  const results = [];

  for (const shortKey of shortKeys) {
    try {
      const linkDataStr = await kv.get(shortKey);
      if (linkDataStr) {
        const linkData = JSON.parse(linkDataStr);
        linkData.isActive = isActive;
        linkData.updatedAt = getCurrentTimestamp();
        
        await kv.put(shortKey, JSON.stringify(linkData));

        results.push({
          shortKey,
          success: true,
          message: `${isActive ? 'Enabled' : 'Disabled'} successfully`
        });
      } else {
        results.push({
          shortKey,
          success: false,
          message: 'Link not found'
        });
      }
    } catch (error) {
      results.push({
        shortKey,
        success: false,
        message: 'Update failed: ' + error.message
      });
    }
  }

  return results;
}

/**
 * 批量导出链接数据
 */
async function batchExport(kv, shortKeys) {
  const results = [];

  for (const shortKey of shortKeys) {
    try {
      const linkDataStr = await kv.get(shortKey);
      if (linkDataStr) {
        const linkData = JSON.parse(linkDataStr);
        
        results.push({
          shortKey,
          success: true,
          data: {
            shortKey: linkData.shortKey,
            longUrl: linkData.longUrl,
            title: linkData.title,
            description: linkData.description,
            maxVisits: linkData.maxVisits,
            currentVisits: linkData.currentVisits,
            totalVisits: linkData.totalVisits,
            expiresAt: linkData.expiresAt,
            accessMode: linkData.accessMode,
            tags: linkData.tags,
            isActive: linkData.isActive,
            createdAt: linkData.createdAt,
            updatedAt: linkData.updatedAt,
            lastVisitAt: linkData.lastVisitAt,
            hasPassword: !!linkData.password
          }
        });
      } else {
        results.push({
          shortKey,
          success: false,
          message: 'Link not found'
        });
      }
    } catch (error) {
      results.push({
        shortKey,
        success: false,
        message: 'Export failed: ' + error.message
      });
    }
  }

  return results;
}
