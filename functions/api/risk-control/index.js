// 风控管理API
import { 
  successResponse, 
  errorResponse, 
  optionsResponse, 
  unauthorizedResponse 
} from '../../utils/response.js';
import { authMiddleware } from '../../utils/auth.js';
import { 
  blockDevice, 
  blockIP, 
  unblockDevice, 
  unblockIP, 
  getVisitStats,
  detectAnomalies
} from '../../utils/risk-control.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 检查D1数据库
  if (!db) {
    return errorResponse('Database not configured', 500, 500);
  }

  // 检查认证
  const auth = await authMiddleware(request, env, db);
  if (!auth || !auth.isAuthenticated) {
    return unauthorizedResponse('Authentication required');
  }

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'block-device':
        return await blockDeviceAction(request, db);
      case 'block-ip':
        return await blockIPAction(request, db);
      case 'unblock-device':
        return await unblockDeviceAction(request, db);
      case 'unblock-ip':
        return await unblockIPAction(request, db);
      case 'get-stats':
        return await getStatsAction(request, db);
      case 'get-blocked':
        return await getBlockedAction(db);
      case 'detect-anomalies':
        return await detectAnomaliesAction(request, db);
      default:
        return errorResponse('Invalid action', 400);
    }
  } catch (error) {
    console.error('Risk control API error:', error);
    return errorResponse('Internal server error', 500, 500);
  }
}

/**
 * 封禁设备
 */
async function blockDeviceAction(request, db) {
  const data = await request.json();
  const { deviceId, reason, duration } = data;

  if (!deviceId || !reason) {
    return errorResponse('Device ID and reason are required', 400);
  }

  // 更新设备状态为封禁
  await db.prepare(`
    UPDATE devices 
    SET is_blocked = 1, block_reason = ?, blocked_at = CURRENT_TIMESTAMP 
    WHERE device_id = ?
  `).bind(reason, deviceId).run();
  
  return successResponse({ deviceId, reason }, 'Device blocked successfully');
}

/**
 * 封禁IP
 */
async function blockIPAction(request, db) {
  const data = await request.json();
  const { ipAddress, reason, duration } = data;

  if (!ipAddress || !reason) {
    return errorResponse('IP address and reason are required', 400);
  }

  // 更新IP状态为封禁
  await db.prepare(`
    UPDATE ip_addresses 
    SET is_blocked = 1, block_reason = ?, blocked_at = CURRENT_TIMESTAMP 
    WHERE ip_address = ?
  `).bind(reason, ipAddress).run();
  
  return successResponse({ ipAddress, reason }, 'IP blocked successfully');
}

/**
 * 解封设备
 */
async function unblockDeviceAction(request, db) {
  const data = await request.json();
  const { deviceId } = data;

  if (!deviceId) {
    return errorResponse('Device ID is required', 400);
  }

  // 更新设备状态为解封
  await db.prepare(`
    UPDATE devices 
    SET is_blocked = 0, block_reason = NULL, blocked_at = NULL 
    WHERE device_id = ?
  `).bind(deviceId).run();
  
  return successResponse({ deviceId }, 'Device unblocked successfully');
}

/**
 * 解封IP
 */
async function unblockIPAction(request, db) {
  const data = await request.json();
  const { ipAddress } = data;

  if (!ipAddress) {
    return errorResponse('IP address is required', 400);
  }

  // 更新IP状态为解封
  await db.prepare(`
    UPDATE ip_addresses 
    SET is_blocked = 0, block_reason = NULL, blocked_at = NULL 
    WHERE ip_address = ?
  `).bind(ipAddress).run();
  
  return successResponse({ ipAddress }, 'IP unblocked successfully');
}

/**
 * 获取访问统计
 */
async function getStatsAction(request, db) {
  const url = new URL(request.url);
  const shortKey = url.searchParams.get('shortKey');

  if (!shortKey) {
    return errorResponse('Short key is required', 400);
  }

  // 从D1数据库获取访问统计
  const linkResult = await db.prepare('SELECT id FROM links WHERE short_key = ?').bind(shortKey).first();
  if (!linkResult) {
    return errorResponse('Link not found', 404);
  }

  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(DISTINCT device_id) as unique_devices,
      COUNT(DISTINCT ip_address) as unique_ips,
      COUNT(CASE WHEN is_proxy_tool = 1 THEN 1 END) as proxy_visits,
      COUNT(CASE WHEN DATE(visit_timestamp) = DATE('now') THEN 1 END) as today_visits
    FROM access_logs 
    WHERE link_id = ?
  `).bind(linkResult.id).first();
  
  return successResponse({ stats: stats || {} });
}

/**
 * 获取被封禁的设备/IP列表
 */
async function getBlockedAction(db) {
  // 从D1数据库获取被封禁的设备
  const blockedDevices = await db.prepare(`
    SELECT device_id, block_reason, blocked_at 
    FROM devices 
    WHERE is_blocked = 1 
    ORDER BY blocked_at DESC
  `).all();

  // 从D1数据库获取被封禁的IP
  const blockedIPs = await db.prepare(`
    SELECT ip_address, block_reason, blocked_at 
    FROM ip_addresses 
    WHERE is_blocked = 1 
    ORDER BY blocked_at DESC
  `).all();

  return successResponse({
    blockedDevices: blockedDevices.results || [],
    blockedIPs: blockedIPs.results || []
  });
}

/**
 * 检测异常访问模式
 */
async function detectAnomaliesAction(request, db) {
  const url = new URL(request.url);
  const shortKey = url.searchParams.get('shortKey');

  if (!shortKey) {
    return errorResponse('Short key is required', 400);
  }

  // 从D1数据库获取访问统计
  const linkResult = await db.prepare('SELECT id FROM links WHERE short_key = ?').bind(shortKey).first();
  if (!linkResult) {
    return errorResponse('Link not found', 404);
  }

  const stats = await db.prepare(`
    SELECT 
      COUNT(*) as total_visits,
      COUNT(DISTINCT device_id) as unique_devices,
      COUNT(DISTINCT ip_address) as unique_ips,
      COUNT(CASE WHEN is_proxy_tool = 1 THEN 1 END) as proxy_visits,
      COUNT(CASE WHEN DATE(visit_timestamp) = DATE('now') THEN 1 END) as today_visits
    FROM access_logs 
    WHERE link_id = ?
  `).bind(linkResult.id).first();
  
  // 简化的异常检测
  const anomalies = {
    high_frequency: stats.today_visits > 100,
    proxy_detected: stats.proxy_visits > 0,
    suspicious_patterns: []
  };
  
  return successResponse({ stats: stats || {}, anomalies });
}
