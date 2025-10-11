// 链接统计API
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  unauthorizedResponse,
  notFoundResponse 
} from '../../utils/response.js';
import { authMiddleware } from '../../utils/auth.js';
import { LinkDB } from '../../utils/database.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const db = env.DB;
  const shortKey = params.shortKey;

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

    // 获取详细统计数据
    const stats = await getDetailedStats(linkDB, linkData);

    return successResponse(stats);

  } catch (error) {
    console.error('Get stats error:', error);
    return errorResponse('Failed to get statistics', 500, 500);
  }
}

/**
 * 获取详细统计数据
 */
async function getDetailedStats(linkDB, linkData) {
  const stats = {
    basic: {
      shortKey: linkData.shortKey,
      longUrl: linkData.longUrl,
      title: linkData.title,
      totalVisits: linkData.totalVisits || 0,
      currentVisits: linkData.currentVisits || 0,
      maxVisits: linkData.maxVisits || -1,
      createdAt: linkData.createdAt,
      lastVisitAt: linkData.lastVisitAt,
      isActive: linkData.isActive,
      expiresAt: linkData.expiresAt
    },
    visitHistory: linkData.visitHistory || [],
    dailyStats: [],
    referrers: {},
    countries: {},
    devices: {}
  };

  // 获取每日统计数据（最近30天）
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

  for (let d = new Date(thirtyDaysAgo); d <= today; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    const dailyStatsKey = `stats:${linkData.shortKey}:${dateStr}`;
    
    try {
      const dailyData = await kv.get(dailyStatsKey);
      if (dailyData) {
        const parsed = JSON.parse(dailyData);
        stats.dailyStats.push({
          date: dateStr,
          visits: parsed.visits || 0,
          uniqueVisitors: parsed.uniqueVisitors || 0
        });
        
        // 合并引荐来源统计
        if (parsed.referrers) {
          for (const [referrer, count] of Object.entries(parsed.referrers)) {
            stats.referrers[referrer] = (stats.referrers[referrer] || 0) + count;
          }
        }
        
        // 合并国家统计
        if (parsed.countries) {
          for (const [country, count] of Object.entries(parsed.countries)) {
            stats.countries[country] = (stats.countries[country] || 0) + count;
          }
        }
        
        // 合并设备统计
        if (parsed.devices) {
          for (const [device, count] of Object.entries(parsed.devices)) {
            stats.devices[device] = (stats.devices[device] || 0) + count;
          }
        }
      } else {
        stats.dailyStats.push({
          date: dateStr,
          visits: 0,
          uniqueVisitors: 0
        });
      }
    } catch (error) {
      console.error(`Error getting daily stats for ${dateStr}:`, error);
      stats.dailyStats.push({
        date: dateStr,
        visits: 0,
        uniqueVisitors: 0
      });
    }
  }

  // 从访问历史中提取统计信息（作为备用）
  if (linkData.visitHistory && linkData.visitHistory.length > 0) {
    const referrerCounts = {};
    const deviceCounts = {};
    
    linkData.visitHistory.forEach(visit => {
      // 统计引荐来源
      const referrer = visit.referer || 'direct';
      const referrerDomain = referrer === 'direct' ? 'direct' : 
        (referrer.includes('://') ? new URL(referrer).hostname : referrer);
      referrerCounts[referrerDomain] = (referrerCounts[referrerDomain] || 0) + 1;
      
      // 简单的设备检测
      const userAgent = visit.userAgent || '';
      let deviceType = 'desktop';
      if (/Mobile|Android|iPhone|iPad/.test(userAgent)) {
        deviceType = /iPad/.test(userAgent) ? 'tablet' : 'mobile';
      }
      deviceCounts[deviceType] = (deviceCounts[deviceType] || 0) + 1;
    });
    
    // 如果没有从每日统计中获取到数据，使用访问历史的数据
    if (Object.keys(stats.referrers).length === 0) {
      stats.referrers = referrerCounts;
    }
    if (Object.keys(stats.devices).length === 0) {
      stats.devices = deviceCounts;
    }
  }

  return stats;
}
