// 访问日志API
import { successResponse, errorResponse } from '../../utils/response.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  try {
    const db = env.DB;
    if (!db) {
      return errorResponse('Database not configured', 500);
    }
    
    const url = new URL(request.url);
    const action = url.searchParams.get('action') || 'list';
    const shortKey = url.searchParams.get('shortKey');
    
    switch (action) {
      case 'list':
        return await getAccessLogs(db, url, shortKey);
      case 'stats':
        return await getAccessStats(db, shortKey);
      case 'clear':
        return await clearAccessLogs(db, shortKey);
      default:
        return errorResponse('Invalid action', 400);
    }
    
  } catch (error) {
    console.error('Access logs API error:', error);
    return errorResponse(`API error: ${error.message}`, 500);
  }
}

/**
 * 获取访问日志列表
 */
async function getAccessLogs(db, url, shortKey) {
  try {
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const offset = parseInt(url.searchParams.get('offset')) || 0;
    
    let sql, params;
    
    if (shortKey) {
      // 获取特定短链接的访问日志
      sql = `
        SELECT al.*, l.short_key, l.long_url
        FROM access_logs al
        JOIN links l ON al.link_id = l.id
        WHERE l.short_key = ?
        ORDER BY al.visit_timestamp DESC
        LIMIT ? OFFSET ?
      `;
      params = [shortKey, limit, offset];
    } else {
      // 获取所有访问日志
      sql = `
        SELECT al.*, l.short_key, l.long_url
        FROM access_logs al
        JOIN links l ON al.link_id = l.id
        ORDER BY al.visit_timestamp DESC
        LIMIT ? OFFSET ?
      `;
      params = [limit, offset];
    }
    
    const logs = await db.prepare(sql).bind(...params).all();
    
    // 获取总数
    let countSql, countParams;
    if (shortKey) {
      countSql = `
        SELECT COUNT(*) as total
        FROM access_logs al
        JOIN links l ON al.link_id = l.id
        WHERE l.short_key = ?
      `;
      countParams = [shortKey];
    } else {
      countSql = 'SELECT COUNT(*) as total FROM access_logs';
      countParams = [];
    }
    
    const countResult = await db.prepare(countSql).bind(...countParams).first();
    const total = countResult?.total || 0;
    
    return successResponse({
      logs: logs.results || [],
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    });
    
  } catch (error) {
    console.error('Failed to get access logs:', error);
    return errorResponse(`Failed to get access logs: ${error.message}`, 500);
  }
}

/**
 * 获取访问统计
 */
async function getAccessStats(db, shortKey) {
  try {
    let sql, params;
    
    if (shortKey) {
      // 获取特定短链接的统计
      sql = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_proxy_tool = 1 THEN 1 END) as proxy,
          COUNT(CASE WHEN is_proxy_tool = 0 THEN 1 END) as browser,
          COUNT(CASE WHEN is_proxy_tool IS NULL THEN 1 END) as unknown
        FROM access_logs al
        JOIN links l ON al.link_id = l.id
        WHERE l.short_key = ?
      `;
      params = [shortKey];
    } else {
      // 获取所有访问统计
      sql = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN is_proxy_tool = 1 THEN 1 END) as proxy,
          COUNT(CASE WHEN is_proxy_tool = 0 THEN 1 END) as browser,
          COUNT(CASE WHEN is_proxy_tool IS NULL THEN 1 END) as unknown
        FROM access_logs
      `;
      params = [];
    }
    
    const stats = await db.prepare(sql).bind(...params).first();
    
    return successResponse({
      total: stats?.total || 0,
      proxy: stats?.proxy || 0,
      browser: stats?.browser || 0,
      unknown: stats?.unknown || 0,
      lastUpdated: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Failed to get access stats:', error);
    return errorResponse(`Failed to get access stats: ${error.message}`, 500);
  }
}

/**
 * 清空访问日志
 */
async function clearAccessLogs(db, shortKey) {
  try {
    let sql, params;
    
    if (shortKey) {
      // 清空特定短链接的访问日志
      sql = `
        DELETE FROM access_logs 
        WHERE link_id IN (SELECT id FROM links WHERE short_key = ?)
      `;
      params = [shortKey];
    } else {
      // 清空所有访问日志
      sql = 'DELETE FROM access_logs';
      params = [];
    }
    
    const result = await db.prepare(sql).bind(...params).run();
    const deletedCount = result.changes || 0;
    
    return successResponse({
      message: shortKey ? 
        `Access logs for ${shortKey} cleared successfully` : 
        'All access logs cleared successfully',
      deletedCount
    });
    
  } catch (error) {
    console.error('Failed to clear access logs:', error);
    return errorResponse(`Failed to clear access logs: ${error.message}`, 500);
  }
}
