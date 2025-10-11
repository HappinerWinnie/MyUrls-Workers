// functions/[shortKey]-d1.js - 短链接访问处理，使用D1数据库
import { isExpired, verifyPassword } from './utils/crypto.js';
import { htmlResponse, redirectResponse, notFoundResponse, forbiddenResponse } from './utils/response.js';
import { 
  generateDeviceFingerprint, 
  isBrowserUserAgent, 
  checkVisitLimits, 
  recordVisit, 
  checkBlocked,
  detectAnomalies,
  getVisitStats,
  detectCountry,
  isCountryAllowed,
  generateMockNodeResponse,
  getDeviceCount,
  isDeviceExists,
  addDeviceToLink
} from './utils/risk-control.js';
import { LinkDB, AccessLogDB, DeviceDB, IPDB, LinkDeviceDB } from './utils/database.js';

export async function onRequest(context) {
  try {
  const { request, env, params } = context;
    const db = env.DB;

    if (!db) {
    return new Response("Service not configured", { status: 500 });
  }

  // 从路径中获取 shortKey
  const shortKey = params.shortKey;
  if (!shortKey) {
    return notFoundResponse("Invalid short key");
  }

    // 初始化数据库操作类
    const linkDB = new LinkDB(db);
    const accessLogDB = new AccessLogDB(db);
    const deviceDB = new DeviceDB(db);
    const ipDB = new IPDB(db);
    const linkDeviceDB = new LinkDeviceDB(db);

    // 从数据库获取链接数据
    const linkData = await linkDB.getLinkByShortKey(shortKey);
    if (!linkData) {
    return notFoundResponse("Short link not found");
  }

  // 检查链接是否激活
    if (!linkData.is_active) {
    return forbiddenResponse("This link has been disabled");
  }

  // 检查是否过期
    if (linkData.expires_at && isExpired(linkData.expires_at)) {
    return forbiddenResponse("This link has expired");
  }

    // 生成设备指纹和IP信息
    const deviceInfo = generateDeviceFingerprint(request);
    const ipAddress = request.headers.get('CF-Connecting-IP') || 
                     request.headers.get('X-Forwarded-For') || 
                     request.headers.get('X-Real-IP') || 
                     'unknown';

    // 增强浏览器检测
    const enhancedBrowserDetection = detectEnhancedBrowser(request, deviceInfo);

  // 检查设备/IP是否被封禁
  const blockedStatus = await checkBlockedDevices(deviceInfo, ipAddress, deviceDB, ipDB);
  if (blockedStatus.deviceBlocked) {
    return forbiddenResponse(`设备已被封禁: ${blockedStatus.deviceBlockReason}`);
  }
  if (blockedStatus.ipBlocked) {
    return forbiddenResponse(`IP已被封禁: ${blockedStatus.ipBlockReason}`);
  }

  // 检查国家限制
  const countryInfo = detectCountry(request);
  const countryRestriction = JSON.parse(linkData.country_restriction || '{}');
  const allowedCountries = countryRestriction.allowedCountries || ['HK', 'JP', 'US', 'SG', 'TW'];
  const isCountryRestricted = countryRestriction.enabled || false;
  
  if (isCountryRestricted && !isCountryAllowed(countryInfo.country, allowedCountries)) {
    // 如果是代理工具访问，返回Mock节点
    if (enhancedBrowserDetection.isProxyTool) {
      const mockResponse = generateMockNodeResponse(countryInfo.country, countryInfo.countryName);
      return new Response(JSON.stringify(mockResponse, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        }
      });
    } else {
      return forbiddenResponse(`当前地区 (${countryInfo.countryName || countryInfo.country}) 不允许访问此链接`);
    }
  }

  // 检查UA过滤
  const uaFilter = JSON.parse(linkData.ua_filter || '{}');
  if (uaFilter.blockBrowsers) {
    if (enhancedBrowserDetection.isBrowser) {
      return forbiddenResponse("此链接不允许浏览器访问");
    }
    if (enhancedBrowserDetection.isAutomationTool) {
      return forbiddenResponse("自动化工具访问已被屏蔽");
    }
    if (enhancedBrowserDetection.isCrawler) {
      return forbiddenResponse("爬虫访问已被屏蔽");
    }
  }

  // 检查风控访问限制
  const visitLimits = JSON.parse(linkData.visit_limits || '{}');
  const visitLimitsCheck = await checkVisitLimits(linkData, deviceInfo, ipAddress, visitLimits, db);
  if (!visitLimitsCheck.allowed) {
    const violation = visitLimitsCheck.violations[0];
    return forbiddenResponse(violation.message);
  }

  // 检查访问次数限制（根据模式）
  if (linkData.visit_limit_mode === 'total' && linkData.max_visits > 0 && linkData.current_visits >= linkData.max_visits) {
    return forbiddenResponse("访问次数已达上限");
  }
  
  // 检查设备数量限制
  if (linkData.visit_limit_mode === 'devices') {
    if (linkData.max_devices > 0) {
      // 有明确的设备数量限制
      const deviceCount = await linkDeviceDB.getLinkDeviceCount(linkData.id);
      if (deviceCount >= linkData.max_devices) {
        // 检查当前设备是否已存在
        const isExistingDevice = await linkDeviceDB.isDeviceInLink(linkData.id, deviceInfo.deviceId);
        if (!isExistingDevice) {
          return forbiddenResponse(`设备数量已达上限 (${linkData.max_devices}个设备)`);
        }
      }
    } else if (linkData.max_visits > 0) {
      // 没有设备数量限制，但有访问次数限制，检查总访问次数
      if (linkData.current_visits >= linkData.max_visits) {
        return forbiddenResponse("访问次数已达上限");
      }
    }
  }

    // 处理密码保护
    if (linkData.password_hash) {
      return await handlePasswordProtection(request, linkData, db);
    }

    // 更新访问统计
    try {
      await updateVisitStats(linkData, db, request, deviceInfo, ipAddress, enhancedBrowserDetection);
  } catch (error) {
      console.error('Update visit stats error:', error);
      // 如果统计更新失败，继续处理请求
    }

    // 根据访问模式处理请求
    switch (linkData.access_mode) {
      case 'proxy':
        return await handleProxyMode(request, linkData);
      case 'iframe':
        return await handleIframeMode(request, linkData);
      case 'redirect':
      default:
        return await handleRedirectMode(request, linkData);
    }
  } catch (error) {
    console.error('Short link handler error:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      url: context?.request?.url,
      shortKey: context?.params?.shortKey
    });
    
    // 返回一个简单的错误页面而不是抛出异常
    return new Response(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Service Error</title>
        <meta charset="UTF-8">
      </head>
      <body>
        <h1>服务暂时不可用</h1>
        <p>请稍后重试或联系管理员</p>
        <p>错误信息: ${error.message}</p>
      </body>
      </html>
    `, {
      status: 500,
      headers: {
        'Content-Type': 'text/html; charset=utf-8'
      }
    });
  }
}

/**
 * 检查设备/IP是否被封禁
 */
async function checkBlockedDevices(deviceInfo, ipAddress, deviceDB, ipDB) {
  const device = await deviceDB.getDevice(deviceInfo.deviceId);
  const ip = await ipDB.getIP(ipAddress);
  
  return {
    deviceBlocked: device && device.is_blocked,
    deviceBlockReason: device ? device.block_reason : null,
    ipBlocked: ip && ip.is_blocked,
    ipBlockReason: ip ? ip.block_reason : null
  };
}

/**
 * 更新访问统计
 */
async function updateVisitStats(linkData, db, request, deviceInfo, ipAddress, enhancedBrowserDetection = null) {
  const linkDB = new LinkDB(db);
  const accessLogDB = new AccessLogDB(db);
  const deviceDB = new DeviceDB(db);
  const ipDB = new IPDB(db);
  const linkDeviceDB = new LinkDeviceDB(db);

  try {
    // 增加访问次数
    await linkDB.incrementVisits(linkData.id);

    // 如果是设备限制模式，添加设备到设备列表
    if (linkData.visit_limit_mode === 'devices') {
      await linkDeviceDB.addDeviceToLink(linkData.id, deviceInfo.deviceId);
    }

    // 记录访问日志
    const accessData = {
      deviceId: deviceInfo.deviceId,
      ipAddress,
      userAgent: request.headers.get('User-Agent') || '',
      referer: request.headers.get('Referer') || null,
      country: request.headers.get('CF-IPCountry') || null,
      city: request.headers.get('CF-City') || null,
      region: request.headers.get('CF-Region') || null,
      riskScore: deviceInfo.riskScore || 0,
      isProxyTool: enhancedBrowserDetection ? enhancedBrowserDetection.isProxyTool : false,
      proxyToolType: enhancedBrowserDetection ? enhancedBrowserDetection.proxyToolType : null,
      browserDetection: enhancedBrowserDetection || {}
    };

    await accessLogDB.logAccess(linkData.id, accessData);

    // 更新设备信息
    await deviceDB.createDevice({
      deviceId: deviceInfo.deviceId,
      fingerprintData: deviceInfo.fingerprint
    });

    // 更新IP信息
    await ipDB.createIP({
      ipAddress,
      country: accessData.country,
      city: accessData.city,
      region: accessData.region
    });

    // 检测异常并发送告警（暂时禁用，因为字段不存在）
    // const riskAlert = JSON.parse(linkData.risk_alert || '{}');
    // if (riskAlert.enabled) {
    //   const anomalies = await detectAnomalies(linkData, deviceInfo, ipAddress, db);
    //   if (anomalies.length > 0) {
    //     await sendRiskAlert(riskAlert, anomalies, linkData);
    //   }
    // }

  } catch (error) {
    console.error('Update visit stats error:', error);
  }
}

/**
 * 处理密码保护
 */
async function handlePasswordProtection(request, linkData, db) {
  const url = new URL(request.url);
  const providedPassword = url.searchParams.get('password');

  if (!providedPassword) {
    return htmlResponse(`
<!DOCTYPE html>
      <html>
<head>
        <title>密码保护</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
          body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; }
          input[type="password"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #0056b3; }
    </style>
</head>
<body>
        <h2>此链接需要密码</h2>
        <form method="GET">
          <div class="form-group">
            <label for="password">请输入密码：</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit">访问链接</button>
        </form>
</body>
      </html>
    `);
  }

  // 验证密码
  const isValid = await verifyPassword(providedPassword, linkData.password_hash);
  if (!isValid) {
    return htmlResponse(`
<!DOCTYPE html>
      <html>
<head>
        <title>密码错误</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
          body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; }
          .error { color: red; margin-bottom: 15px; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; }
          input[type="password"] { width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; }
          button { background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; }
          button:hover { background: #0056b3; }
    </style>
</head>
      <body>
        <h2>此链接需要密码</h2>
        <div class="error">密码错误，请重试</div>
        <form method="GET">
          <div class="form-group">
            <label for="password">请输入密码：</label>
            <input type="password" id="password" name="password" required>
        </div>
          <button type="submit">访问链接</button>
        </form>
</body>
      </html>
    `);
  }

  // 密码正确，继续处理
  return null;
}

/**
 * 处理代理模式
 */
async function handleProxyMode(request, linkData) {
  // 获取目标URL的响应
  try {
    const response = await fetch(linkData.long_url, {
      method: request.method,
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'ClashMeta',
        'Accept': request.headers.get('Accept') || '*/*',
        'Accept-Language': request.headers.get('Accept-Language') || 'en-US,en;q=0.9',
        'Accept-Encoding': request.headers.get('Accept-Encoding') || 'gzip, deflate',
        'Cache-Control': request.headers.get('Cache-Control') || 'no-cache',
        'Pragma': request.headers.get('Pragma') || 'no-cache'
      },
      body: request.body
    });

    // 解析自定义响应头
    let customHeaders = {};
    try {
      if (linkData.custom_headers) {
        customHeaders = JSON.parse(linkData.custom_headers);
      }
    } catch (error) {
      console.error('Failed to parse custom headers:', error);
    }

    // 合并响应头
    const responseHeaders = Object.fromEntries(response.headers.entries());
    const finalHeaders = { ...responseHeaders, ...customHeaders };

    // 创建新的响应
    const newResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: finalHeaders
    });

    return newResponse;
  } catch (error) {
    console.error('Proxy mode error:', error);
    return forbiddenResponse("Failed to proxy request");
  }
}

/**
 * 处理嵌入模式
 */
async function handleIframeMode(request, linkData) {
  return htmlResponse(`
<!DOCTYPE html>
    <html>
<head>
      <title>${linkData.title || 'Loading...'}</title>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { margin: 0; padding: 0; }
        iframe { width: 100vw; height: 100vh; border: none; }
    </style>
</head>
<body>
      <iframe src="${linkData.long_url}" allowfullscreen></iframe>
</body>
    </html>
  `);
}

/**
 * 处理重定向模式
 */
async function handleRedirectMode(request, linkData) {
  return redirectResponse(linkData.long_url, 302);
}

/**
 * 增强浏览器检测
 */
function detectEnhancedBrowser(request, deviceInfo) {
  const userAgent = request.headers.get('User-Agent') || '';
  
  return {
    isBrowser: isBrowserUserAgent(userAgent),
    isAutomationTool: userAgent.includes('clash') || userAgent.includes('v2ray') || userAgent.includes('quantumult'),
    isCrawler: userAgent.includes('bot') || userAgent.includes('spider') || userAgent.includes('crawler'),
    isProxyTool: userAgent.includes('clash') || userAgent.includes('v2ray') || userAgent.includes('quantumult'),
    proxyToolType: userAgent.includes('clash') ? 'Clash' : 
                   userAgent.includes('v2ray') ? 'V2Ray' : 
                   userAgent.includes('quantumult') ? 'Quantumult' : 'Unknown',
    confidence: 0.8
  };
}

/**
 * 发送风控告警
 */
async function sendRiskAlert(riskAlert, anomalies, linkData) {
  if (!riskAlert.telegramToken || !riskAlert.telegramChatId) {
    return;
  }

  try {
    const message = `🚨 风控告警\n\n链接: ${linkData.short_key}\n异常: ${anomalies.join(', ')}\n时间: ${new Date().toISOString()}`;
    
    await fetch(`https://api.telegram.org/bot${riskAlert.telegramToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: riskAlert.telegramChatId,
        text: message
      })
    });
  } catch (error) {
    console.error('Send risk alert error:', error);
  }
}
