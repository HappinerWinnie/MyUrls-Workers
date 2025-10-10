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

  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  try {
    switch (action) {
      case 'block-device':
        return await blockDeviceAction(request, kv);
      case 'block-ip':
        return await blockIPAction(request, kv);
      case 'unblock-device':
        return await unblockDeviceAction(request, kv);
      case 'unblock-ip':
        return await unblockIPAction(request, kv);
      case 'get-stats':
        return await getStatsAction(request, kv);
      case 'get-blocked':
        return await getBlockedAction(kv);
      case 'detect-anomalies':
        return await detectAnomaliesAction(request, kv);
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
async function blockDeviceAction(request, kv) {
  const data = await request.json();
  const { deviceId, reason, duration } = data;

  if (!deviceId || !reason) {
    return errorResponse('Device ID and reason are required', 400);
  }

  const blockData = await blockDevice(deviceId, reason, duration, kv);
  
  return successResponse(blockData, 'Device blocked successfully');
}

/**
 * 封禁IP
 */
async function blockIPAction(request, kv) {
  const data = await request.json();
  const { ipAddress, reason, duration } = data;

  if (!ipAddress || !reason) {
    return errorResponse('IP address and reason are required', 400);
  }

  const blockData = await blockIP(ipAddress, reason, duration, kv);
  
  return successResponse(blockData, 'IP blocked successfully');
}

/**
 * 解封设备
 */
async function unblockDeviceAction(request, kv) {
  const data = await request.json();
  const { deviceId } = data;

  if (!deviceId) {
    return errorResponse('Device ID is required', 400);
  }

  await unblockDevice(deviceId, kv);
  
  return successResponse({ deviceId }, 'Device unblocked successfully');
}

/**
 * 解封IP
 */
async function unblockIPAction(request, kv) {
  const data = await request.json();
  const { ipAddress } = data;

  if (!ipAddress) {
    return errorResponse('IP address is required', 400);
  }

  await unblockIP(ipAddress, kv);
  
  return successResponse({ ipAddress }, 'IP unblocked successfully');
}

/**
 * 获取访问统计
 */
async function getStatsAction(request, kv) {
  const url = new URL(request.url);
  const shortKey = url.searchParams.get('shortKey');

  if (!shortKey) {
    return errorResponse('Short key is required', 400);
  }

  const stats = await getVisitStats(shortKey, kv);
  
  return successResponse({ stats });
}

/**
 * 获取被封禁的设备/IP列表
 */
async function getBlockedAction(kv) {
  const { keys: deviceKeys } = await kv.list({ prefix: 'blocked:device:' });
  const { keys: ipKeys } = await kv.list({ prefix: 'blocked:ip:' });

  const blockedDevices = [];
  const blockedIPs = [];

  // 获取被封禁的设备
  for (const key of deviceKeys) {
    const data = await kv.get(key.name);
    if (data) {
      blockedDevices.push(JSON.parse(data));
    }
  }

  // 获取被封禁的IP
  for (const key of ipKeys) {
    const data = await kv.get(key.name);
    if (data) {
      blockedIPs.push(JSON.parse(data));
    }
  }

  return successResponse({
    blockedDevices,
    blockedIPs
  });
}

/**
 * 检测异常访问模式
 */
async function detectAnomaliesAction(request, kv) {
  const url = new URL(request.url);
  const shortKey = url.searchParams.get('shortKey');

  if (!shortKey) {
    return errorResponse('Short key is required', 400);
  }

  const stats = await getVisitStats(shortKey, kv);
  const anomalies = detectAnomalies(stats);
  
  return successResponse({ anomalies });
}
