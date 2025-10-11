// 数据库状态管理API
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  unauthorizedResponse 
} from '../../utils/response.js';
import { authMiddleware } from '../../utils/auth.js';
import { LinkDB } from '../../utils/database.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 检查数据库配置
  if (!db) {
    return errorResponse('Database not configured', 500, 500);
  }

  // 检查认证
  const auth = await authMiddleware(request, env, db);
  if (!auth || !auth.isAuthenticated) {
    return unauthorizedResponse('Authentication required');
  }

  switch (request.method) {
    case 'DELETE':
      return await clearDatabaseCache(db);
    case 'GET':
      return await getDatabaseStatus(db);
    default:
      return errorResponse('Method not allowed', 405, 405);
  }
}

/**
 * 清除数据库缓存（D1数据库不需要手动清除缓存）
 */
async function clearDatabaseCache(db) {
  try {
    // D1数据库会自动管理缓存，这里只是返回成功消息
    console.log('Database cache management not needed for D1');
    return successResponse(null, 'Database cache is automatically managed');
  } catch (error) {
    console.error('Clear cache error:', error);
    return errorResponse('Failed to clear cache', 500, 500);
  }
}

/**
 * 获取数据库状态
 */
async function getDatabaseStatus(db) {
  try {
    const linkDB = new LinkDB(db);
    
    // 获取数据库统计信息
    const stats = {
      databaseType: 'D1',
      totalLinks: 0,
      activeLinks: 0,
      totalVisits: 0,
      lastUpdated: new Date().toISOString()
    };

    try {
      const links = await linkDB.getAll();
      stats.totalLinks = links.length;
      stats.activeLinks = links.filter(link => link.isActive).length;
      stats.totalVisits = links.reduce((sum, link) => sum + (link.totalVisits || 0), 0);
    } catch (error) {
      console.error('Error getting database stats:', error);
      stats.error = error.message;
    }

    return successResponse(stats);
  } catch (error) {
    console.error('Get database status error:', error);
    return errorResponse('Failed to get database status', 500, 500);
  }
}
