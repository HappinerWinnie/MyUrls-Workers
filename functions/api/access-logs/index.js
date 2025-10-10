// 访问日志API
import { successResponse, errorResponse } from '../../utils/response.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  try {
    const kv = env.LINKS;
    if (!kv) {
      return errorResponse('KV storage not configured', 500);
    }
    
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    
    switch (action) {
      case 'list':
        return await getAccessLogs(kv, url);
      case 'stats':
        return await getAccessStats(kv);
      case 'clear':
        return await clearAccessLogs(kv);
      default:
        return errorResponse('Invalid action', 400);
    }
    
  } catch (error) {
    return errorResponse(`API error: ${error.message}`, 500);
  }
}

/**
 * 获取访问日志列表
 */
async function getAccessLogs(kv, url) {
  try {
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    
    // 获取所有访问日志
    const { keys } = await kv.list({ prefix: 'access_log:' });
    
    // 按时间排序（最新的在前）
    const sortedKeys = keys.sort((a, b) => b.name.localeCompare(a.name));
    
    // 分页
    const paginatedKeys = sortedKeys.slice(offset, offset + limit);
    
    // 获取日志数据
    const logs = [];
    for (const key of paginatedKeys) {
      const data = await kv.get(key.name);
      if (data) {
        const log = JSON.parse(data);
        // 只返回必要的信息，不包含完整的调试信息
        logs.push({
          id: log.id,
          timestamp: log.timestamp,
          method: log.method,
          url: log.url,
          userAgent: log.userAgent,
          isProxyTool: log.isProxyTool,
          proxyToolType: log.proxyToolType,
          headers: log.headers,
          cfInfo: log.cfInfo,
          stats: log.stats
        });
      }
    }
    
    return successResponse({
      logs,
      total: keys.length,
      limit,
      offset,
      hasMore: offset + limit < keys.length
    });
    
  } catch (error) {
    return errorResponse(`Failed to get access logs: ${error.message}`, 500);
  }
}

/**
 * 获取访问统计
 */
async function getAccessStats(kv) {
  try {
    const statsData = await kv.get('access_stats');
    
    if (!statsData) {
      return successResponse({
        total: 0,
        proxy: 0,
        browser: 0,
        unknown: 0,
        lastUpdated: null
      });
    }
    
    const stats = JSON.parse(statsData);
    return successResponse(stats);
    
  } catch (error) {
    return errorResponse(`Failed to get access stats: ${error.message}`, 500);
  }
}

/**
 * 清空访问日志
 */
async function clearAccessLogs(kv) {
  try {
    // 获取所有访问日志键
    const { keys } = await kv.list({ prefix: 'access_log:' });
    
    // 删除所有访问日志
    for (const key of keys) {
      await kv.delete(key.name);
    }
    
    // 重置统计
    await kv.delete('access_stats');
    
    return successResponse({
      message: 'Access logs cleared successfully',
      deletedCount: keys.length
    });
    
  } catch (error) {
    return errorResponse(`Failed to clear access logs: ${error.message}`, 500);
  }
}
