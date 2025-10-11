// 总体统计API
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

  // 只允许GET请求
  if (request.method !== 'GET') {
    return errorResponse('Method not allowed', 405, 405);
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

  try {
    const linkDB = new LinkDB(db);
    const overview = await getOverviewStats(linkDB);
    return successResponse(overview);

  } catch (error) {
    console.error('Get overview stats error:', error);
    return errorResponse('Failed to get overview statistics', 500, 500);
  }
}

/**
 * 获取总体统计数据
 */
async function getOverviewStats(linkDB) {
  const stats = {
    totalLinks: 0,
    activeLinks: 0,
    totalVisits: 0,
    todayVisits: 0,
    thisWeekVisits: 0,
    thisMonthVisits: 0,
    topLinks: [],
    recentLinks: [],
    dailyVisits: [], // 最近30天的每日访问量
    linksByStatus: {
      active: 0,
      expired: 0,
      limitReached: 0,
      disabled: 0
    }
  };

  try {
    // 获取所有链接
    const links = await linkDB.getAllLinks();
    stats.totalLinks = links.length;
  
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  links.forEach(link => {
    // 总访问量
    stats.totalVisits += link.totalVisits || 0;
    
    // 链接状态统计
    if (!link.isActive) {
      stats.linksByStatus.disabled++;
    } else if (link.expiresAt && new Date(link.expiresAt) < now) {
      stats.linksByStatus.expired++;
    } else if (link.maxVisits > 0 && link.currentVisits >= link.maxVisits) {
      stats.linksByStatus.limitReached++;
    } else {
      stats.linksByStatus.active++;
      stats.activeLinks++;
    }
    
    // 今日访问量（简化计算）
    if (link.lastVisitAt && link.lastVisitAt.startsWith(today)) {
      stats.todayVisits += 1; // 简化统计，实际应该统计当天的访问次数
    }
  });

  // 获取访问量最高的链接
  stats.topLinks = links
    .sort((a, b) => (b.totalVisits || 0) - (a.totalVisits || 0))
    .slice(0, 10)
    .map(link => ({
      shortKey: link.shortKey,
      longUrl: link.longUrl,
      title: link.title,
      totalVisits: link.totalVisits || 0,
      createdAt: link.createdAt
    }));

  // 获取最近创建的链接
  stats.recentLinks = links
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10)
    .map(link => ({
      shortKey: link.shortKey,
      longUrl: link.longUrl,
      title: link.title,
      totalVisits: link.totalVisits || 0,
      createdAt: link.createdAt
    }));

  // 获取最近30天的每日访问统计
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  for (let d = new Date(thirtyDaysAgo); d <= now; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    let dailyVisits = 0;
    
    // 从所有链接的每日统计中汇总
    for (const link of links) {
      const dailyStatsKey = `stats:${link.shortKey}:${dateStr}`;
      try {
        const dailyData = await kv.get(dailyStatsKey);
        if (dailyData) {
          const parsed = JSON.parse(dailyData);
          dailyVisits += parsed.visits || 0;
        }
      } catch (error) {
        // 忽略错误，继续处理下一个
      }
    }
    
    stats.dailyVisits.push({
      date: dateStr,
      visits: dailyVisits
    });
    
    // 计算周访问量和月访问量
    const date = new Date(dateStr);
    if (date >= weekAgo) {
      stats.thisWeekVisits += dailyVisits;
    }
    if (date >= monthAgo) {
      stats.thisMonthVisits += dailyVisits;
    }
  }

    return stats;
  } catch (error) {
    console.error('Error getting overview stats:', error);
    return stats;
  }
}
