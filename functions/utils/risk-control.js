// 风控系统工具函数
import { generateUUID, getCurrentTimestamp } from './crypto.js';

// 默认允许的国家列表
const DEFAULT_ALLOWED_COUNTRIES = ['HK', 'JP', 'US', 'SG', 'TW'];

// 国家名称映射
const COUNTRY_NAMES = {
  'HK': '香港',
  'JP': '日本', 
  'US': '美国',
  'SG': '新加坡',
  'TW': '台湾',
  'CN': '中国',
  'KR': '韩国',
  'GB': '英国',
  'DE': '德国',
  'FR': '法国',
  'CA': '加拿大',
  'AU': '澳大利亚'
};

/**
 * 设备指纹生成（基于实际可用的请求头信息）
 */
export function generateDeviceFingerprint(request) {
  const headers = request.headers;
  const userAgent = headers.get('User-Agent') || '';
  const acceptLanguage = headers.get('Accept-Language') || '';
  const acceptEncoding = headers.get('Accept-Encoding') || '';
  const connection = headers.get('Connection') || '';
  const cacheControl = headers.get('Cache-Control') || '';
  const referer = headers.get('Referer') || '';
  const origin = headers.get('Origin') || '';
  
  // 从User-Agent中提取信息
  const platform = extractPlatform(userAgent);
  const browser = extractBrowser(userAgent);
  
  // 从请求头中提取实际可用的信息
  const screenInfo = extractScreenFromHeaders(request);
  const timezone = extractTimezoneFromHeaders(request);
  
  // 检测现代浏览器特征（这些是真实存在的请求头）
  const modernBrowserFeatures = detectModernBrowserFeatures(request);
  
  // 构建指纹数据（只包含实际可用的信息）
  const fingerprintData = {
    userAgent,
    acceptLanguage,
    acceptEncoding,
    connection,
    cacheControl,
    referer,
    origin,
    platform,
    browser,
    screenInfo,
    timezone,
    modernBrowserFeatures,
    browserFeatures: modernBrowserFeatures, // 添加browserFeatures字段
    timestamp: getCurrentTimestamp()
  };
  
  // 生成设备ID
  const deviceId = generateDeviceId(fingerprintData);
  
  // 判断是否为浏览器（基于实际可用的信息）
  const isBrowser = isBrowserUserAgent(userAgent) || 
                   hasModernBrowserFeatures(modernBrowserFeatures);
  
  return {
    deviceId,
    fingerprint: fingerprintData,
    isBrowser,
    riskScore: calculateRiskScore(fingerprintData)
  };
}

/**
 * 生成设备ID
 */
function generateDeviceId(fingerprintData) {
  const dataString = JSON.stringify(fingerprintData, Object.keys(fingerprintData).sort());
  return btoa(dataString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
}

/**
 * 提取平台信息
 */
function extractPlatform(userAgent) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('macintosh') || ua.includes('mac os')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS';
  return 'Unknown';
}

/**
 * 提取浏览器信息
 */
function extractBrowser(userAgent) {
  const ua = userAgent.toLowerCase();
  if (ua.includes('chrome') && !ua.includes('edg')) return 'Chrome';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'Safari';
  if (ua.includes('edg')) return 'Edge';
  if (ua.includes('opera')) return 'Opera';
  if (ua.includes('clash')) return 'Clash';
  if (ua.includes('v2ray')) return 'V2Ray';
  if (ua.includes('quantumult')) return 'Quantumult';
  if (ua.includes('surge')) return 'Surge';
  return 'Unknown';
}

/**
 * 从请求头中提取屏幕信息（实际可用的）
 */
function extractScreenFromHeaders(request) {
  const headers = request.headers;
  
  // 尝试从实际存在的请求头中获取屏幕信息
  const viewportWidth = headers.get('Sec-Ch-Ua-Viewport-Width');
  const viewportHeight = headers.get('Sec-Ch-Ua-Viewport-Height');
  
  if (viewportWidth && viewportHeight) {
    return {
      width: viewportWidth,
      height: viewportHeight,
      source: 'sec-ch-ua'
    };
  }
  
  // 从User-Agent中尝试提取移动设备分辨率
  const userAgent = headers.get('User-Agent') || '';
  const mobileMatch = userAgent.match(/(\d+)x(\d+)/);
  if (mobileMatch) {
    return {
      width: mobileMatch[1],
      height: mobileMatch[2],
      source: 'user-agent'
    };
  }
  
  return {
    width: 'Unknown',
    height: 'Unknown',
    source: 'none'
  };
}

/**
 * 从请求头中提取时区信息（实际可用的）
 */
function extractTimezoneFromHeaders(request) {
  const headers = request.headers;
  
  // Cloudflare提供的时区信息
  const cfTimezone = headers.get('CF-Timezone');
  if (cfTimezone) {
    return cfTimezone;
  }
  
  // 自定义时区头（如果客户端发送）
  const customTimezone = headers.get('X-Timezone');
  if (customTimezone) {
    return customTimezone;
  }
  
  return 'UTC';
}

/**
 * 检测现代浏览器特征（基于真实存在的请求头）
 */
function detectModernBrowserFeatures(request) {
  const headers = request.headers;
  
  return {
    // Sec-Fetch-* 头（现代浏览器特有）
    hasSecFetch: !!(
      headers.get('Sec-Fetch-Site') ||
      headers.get('Sec-Fetch-Mode') ||
      headers.get('Sec-Fetch-Dest') ||
      headers.get('Sec-Fetch-User')
    ),
    
    // Sec-Ch-Ua-* 头（Chrome特有）
    hasSecChUa: !!(
      headers.get('Sec-Ch-Ua') ||
      headers.get('Sec-Ch-Ua-Mobile') ||
      headers.get('Sec-Ch-Ua-Platform')
    ),
    
    // 其他现代浏览器特征
    hasUpgradeInsecureRequests: headers.get('Upgrade-Insecure-Requests') === '1',
    hasDNT: headers.get('DNT') === '1',
    hasSaveData: headers.get('Save-Data') === 'on',
    
    // 浏览器窗口信息（如果客户端发送）
    hasViewportInfo: !!(
      headers.get('Sec-Ch-Ua-Viewport-Width') ||
      headers.get('Sec-Ch-Ua-Viewport-Height')
    ),
    
    // 浏览器行为特征
    hasReferer: !!headers.get('Referer'),
    hasOrigin: !!headers.get('Origin'),
    
    // 请求类型
    isAjax: headers.get('X-Requested-With') === 'XMLHttpRequest',
    isFetch: headers.get('Sec-Fetch-Mode') === 'cors',
    isNavigation: headers.get('Sec-Fetch-Mode') === 'navigate',
    
    // 安全特征
    hasCSRF: !!headers.get('X-CSRF-Token'),
    hasCSRFProtection: !!headers.get('X-Requested-With')
  };
}

/**
 * 判断是否为浏览器User-Agent
 */
export function isBrowserUserAgent(userAgent) {
  const ua = userAgent.toLowerCase();
  const browserPatterns = [
    'mozilla', 'chrome', 'safari', 'firefox', 'edge', 'opera',
    'webkit', 'gecko', 'trident'
  ];
  
  return browserPatterns.some(pattern => ua.includes(pattern));
}

/**
 * 判断是否有现代浏览器特征
 */
function hasModernBrowserFeatures(modernBrowserFeatures) {
  // 检查现代浏览器特征
  return modernBrowserFeatures.hasSecFetch || 
         modernBrowserFeatures.hasSecChUa || 
         modernBrowserFeatures.hasUpgradeInsecureRequests || 
         modernBrowserFeatures.hasDNT || 
         modernBrowserFeatures.hasSaveData ||
         modernBrowserFeatures.hasViewportInfo;
}

/**
 * 增强的浏览器检测
 */
function detectBrowserType(fingerprintData) {
  const { userAgent, browserFeatures, screenResolution, fonts, plugins } = fingerprintData;
  const ua = userAgent.toLowerCase();
  
  // 检测Chrome
  if (ua.includes('chrome') && !ua.includes('edg')) {
    return {
      type: 'Chrome',
      confidence: calculateBrowserConfidence('Chrome', fingerprintData),
      features: {
        hasSecChUa: !!browserFeatures.secChUa,
        hasUpgradeInsecureRequests: browserFeatures.upgradeInsecureRequests === '1',
        hasWebGL: !!browserFeatures.webglVendor,
        hasCanvas: !!fingerprintData.canvasFingerprint
      }
    };
  }
  
  // 检测Firefox
  if (ua.includes('firefox')) {
    return {
      type: 'Firefox',
      confidence: calculateBrowserConfidence('Firefox', fingerprintData),
      features: {
        hasDNT: browserFeatures.dnt === '1',
        hasWebGL: !!browserFeatures.webglVendor,
        hasCanvas: !!fingerprintData.canvasFingerprint
      }
    };
  }
  
  // 检测Safari
  if (ua.includes('safari') && !ua.includes('chrome')) {
    return {
      type: 'Safari',
      confidence: calculateBrowserConfidence('Safari', fingerprintData),
      features: {
        hasWebGL: !!browserFeatures.webglVendor,
        hasCanvas: !!fingerprintData.canvasFingerprint,
        isMobile: ua.includes('mobile')
      }
    };
  }
  
  // 检测Edge
  if (ua.includes('edg')) {
    return {
      type: 'Edge',
      confidence: calculateBrowserConfidence('Edge', fingerprintData),
      features: {
        hasSecChUa: !!browserFeatures.secChUa,
        hasUpgradeInsecureRequests: browserFeatures.upgradeInsecureRequests === '1',
        hasWebGL: !!browserFeatures.webglVendor
      }
    };
  }
  
  // 检测移动浏览器
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    return {
      type: 'Mobile Browser',
      confidence: calculateBrowserConfidence('Mobile', fingerprintData),
      features: {
        isMobile: true,
        hasWebGL: !!browserFeatures.webglVendor,
        hasCanvas: !!fingerprintData.canvasFingerprint
      }
    };
  }
  
  // 检测代理工具
  if (ua.includes('clash') || ua.includes('v2ray') || ua.includes('quantumult') || ua.includes('surge')) {
    return {
      type: 'Proxy Tool',
      confidence: 0.9,
      features: {
        isProxy: true,
        toolName: extractBrowser(userAgent)
      }
    };
  }
  
  return {
    type: 'Unknown',
    confidence: 0.1,
    features: {}
  };
}

/**
 * 计算浏览器检测置信度
 */
function calculateBrowserConfidence(browserType, fingerprintData) {
  let confidence = 0.5; // 基础置信度
  
  const { userAgent, browserFeatures, screenResolution, fonts, plugins } = fingerprintData;
  
  // User-Agent匹配度
  if (userAgent && userAgent.length > 10) {
    confidence += 0.2;
  }
  
  // 浏览器特征头
  if (browserFeatures && typeof browserFeatures === 'object') {
    const hasBrowserHeaders = Object.values(browserFeatures).some(value => value && value !== '');
    if (hasBrowserHeaders) {
      confidence += 0.2;
    }
  }
  
  // 屏幕分辨率
  if (screenResolution && screenResolution !== 'Unknown') {
    confidence += 0.1;
  }
  
  // 字体信息
  if (Array.isArray(fonts) && fonts.length > 0) {
    confidence += 0.1;
  }
  
  // 插件信息
  if (Array.isArray(plugins) && plugins.length > 0) {
    confidence += 0.1;
  }
  
  // Canvas/WebGL指纹
  if (fingerprintData.canvasFingerprint || fingerprintData.webglFingerprint) {
    confidence += 0.2;
  }
  
  return Math.min(1.0, confidence);
}

/**
 * 计算风险评分（基于实际可用的信息）
 */
function calculateRiskScore(fingerprintData) {
  let score = 0;
  
  // 基础风险评分
  score += 10;
  
  // 浏览器检测结果
  const browserDetection = detectBrowserType(fingerprintData);
  
  // 浏览器特征风险
  if (isBrowserUserAgent(fingerprintData.userAgent)) {
    score += 20; // 浏览器访问风险较高
  }
  
  // 基于浏览器类型的风险调整
  switch (browserDetection.type) {
    case 'Chrome':
      score += 15; // Chrome浏览器风险中等
      break;
    case 'Firefox':
      score += 12; // Firefox风险较低
      break;
    case 'Safari':
      score += 10; // Safari风险较低
      break;
    case 'Edge':
      score += 15; // Edge风险中等
      break;
    case 'Mobile Browser':
      score += 5; // 移动浏览器风险较低
      break;
    case 'Proxy Tool':
      score -= 15; // 代理工具风险很低
      break;
    case 'Unknown':
      score += 25; // 未知类型风险较高
      break;
  }
  
  // 基于检测置信度的调整
  if (browserDetection.confidence < 0.3) {
    score += 20; // 低置信度风险较高
  } else if (browserDetection.confidence > 0.8) {
    score -= 5; // 高置信度风险较低
  }
  
  // 移动设备风险较低
  if (fingerprintData.platform === 'Android' || fingerprintData.platform === 'iOS') {
    score -= 5;
  }
  
  // 代理工具风险较低
  if (['Clash', 'V2Ray', 'Quantumult', 'Surge'].includes(fingerprintData.browser)) {
    score -= 10;
  }
  
  // 异常User-Agent风险较高
  if (fingerprintData.userAgent.length < 10 || fingerprintData.userAgent.length > 500) {
    score += 30;
  }
  
  // 缺少常见头信息风险较高
  if (!fingerprintData.acceptLanguage) score += 15;
  if (!fingerprintData.acceptEncoding) score += 10;
  
  // 现代浏览器特征检测
  const modernFeatures = fingerprintData.modernBrowserFeatures || {};
  if (modernFeatures.hasSecFetch || modernFeatures.hasSecChUa) {
    score -= 10; // 有现代浏览器特征说明是真实浏览器
  } else if (fingerprintData.userAgent && !modernFeatures.hasSecFetch && !modernFeatures.hasSecChUa) {
    score += 15; // 缺少现代浏览器特征风险较高
  }
  
  // 屏幕信息检测
  if (fingerprintData.screenInfo && fingerprintData.screenInfo.source !== 'none') {
    score -= 5; // 有屏幕信息说明是真实设备
  }
  
  // 时区信息检测
  if (fingerprintData.timezone && fingerprintData.timezone !== 'UTC') {
    score -= 3; // 有时区信息说明是真实用户
  }
  
  // 异常访问模式检测
  if (modernFeatures.isAjax && !modernFeatures.hasOrigin) {
    score += 10; // 可能的自动化请求
  }
  
  // 跨站访问检测
  if (modernFeatures.isFetch && !modernFeatures.hasReferer) {
    score += 15; // 跨站访问且无referer风险较高
  }
  
  // 缺少浏览器行为特征
  if (!modernFeatures.hasReferer && !modernFeatures.hasOrigin && fingerprintData.userAgent) {
    score += 10; // 缺少浏览器行为特征风险较高
  }
  
  return Math.max(0, Math.min(100, score));
}

/**
 * 增强的浏览器检测（基于实际可用的信息）
 */
export function detectEnhancedBrowser(request, deviceInfo) {
  const headers = request.headers;
  const userAgent = headers.get('User-Agent') || '';
  
  // 基础浏览器检测
  const basicDetection = detectBrowserType(deviceInfo.fingerprint);
  
  // 使用已有的现代浏览器特征检测
  const modernBrowserFeatures = deviceInfo.fingerprint.modernBrowserFeatures || {};
  
  // 计算浏览器检测置信度
  let confidence = basicDetection.confidence;
  
  // 现代浏览器特征加分
  if (modernBrowserFeatures.hasSecFetch) confidence += 0.2;
  if (modernBrowserFeatures.hasSecChUa) confidence += 0.15;
  if (modernBrowserFeatures.hasUpgradeInsecureRequests) confidence += 0.1;
  if (modernBrowserFeatures.hasDNT) confidence += 0.05;
  if (modernBrowserFeatures.hasSaveData) confidence += 0.05;
  if (modernBrowserFeatures.hasViewportInfo) confidence += 0.1;
  
  // 检测可能的自动化工具
  const isAutomationTool = detectAutomationTool(request, deviceInfo);
  
  // 检测可能的爬虫
  const isCrawler = detectCrawler(userAgent);
  
  // 检测可能的代理工具
  const isProxyTool = detectProxyTool(userAgent);
  
  return {
    ...basicDetection,
    confidence: Math.min(1.0, confidence),
    modernBrowserFeatures,
    isAutomationTool,
    isCrawler,
    isProxyTool,
    isBrowser: basicDetection.type !== 'Proxy Tool' && 
               !isAutomationTool && 
               !isCrawler &&
               (basicDetection.type !== 'Unknown' || confidence > 0.5)
  };
}

/**
 * 检测自动化工具
 */
function detectAutomationTool(request, deviceInfo) {
  const userAgent = request.headers.get('User-Agent') || '';
  const ua = userAgent.toLowerCase();
  
  // 常见的自动化工具标识
  const automationPatterns = [
    'selenium', 'webdriver', 'phantomjs', 'headless',
    'puppeteer', 'playwright', 'cypress', 'testcafe',
    'automation', 'bot', 'crawler', 'spider',
    'scraper', 'scraping', 'python-requests',
    'curl', 'wget', 'postman', 'insomnia'
  ];
  
  // 检查User-Agent
  const hasAutomationUA = automationPatterns.some(pattern => ua.includes(pattern));
  
  // 检查请求头特征
  const hasAutomationHeaders = (
    request.headers.get('X-Requested-With') === 'XMLHttpRequest' &&
    !request.headers.get('Origin') &&
    !request.headers.get('Referer')
  );
  
  // 检查缺少浏览器特征
  const missingBrowserFeatures = !(
    request.headers.get('Sec-Fetch-Site') ||
    request.headers.get('Sec-Fetch-Mode') ||
    request.headers.get('Accept-Language') ||
    request.headers.get('Accept-Encoding')
  );
  
  return hasAutomationUA || (hasAutomationHeaders && missingBrowserFeatures);
}

/**
 * 检测爬虫
 */
function detectCrawler(userAgent) {
  const ua = userAgent.toLowerCase();
  
  const crawlerPatterns = [
    'googlebot', 'bingbot', 'slurp', 'duckduckbot',
    'baiduspider', 'yandexbot', 'facebookexternalhit',
    'twitterbot', 'linkedinbot', 'whatsapp',
    'telegrambot', 'discordbot', 'slackbot',
    'applebot', 'ia_archiver', 'wayback',
    'archive.org', 'web.archive.org'
  ];
  
  return crawlerPatterns.some(pattern => ua.includes(pattern));
}

/**
 * 检测访问者所在国家
 */
export function detectCountry(request) {
  // 从Cloudflare请求头获取国家信息
  const cfCountry = request.headers.get('cf-ipcountry') || '';
  const cfCity = request.headers.get('cf-city') || '';
  const cfRegion = request.headers.get('cf-region') || '';
  
  return {
    country: cfCountry,
    city: cfCity,
    region: cfRegion,
    countryName: COUNTRY_NAMES[cfCountry] || cfCountry
  };
}

/**
 * 检查国家是否在允许列表中
 */
export function isCountryAllowed(country, allowedCountries = DEFAULT_ALLOWED_COUNTRIES) {
  if (!country) return false;
  return allowedCountries.includes(country.toUpperCase());
}

/**
 * 获取链接的设备数量
 */
export async function getDeviceCount(shortKey, kv) {
  try {
    const deviceListKey = `link_devices:${shortKey}`;
    const deviceListStr = await kv.get(deviceListKey);
    
    if (!deviceListStr) {
      return 0;
    }
    
    const deviceList = JSON.parse(deviceListStr);
    return deviceList.length;
  } catch (error) {
    console.error('Error getting device count:', error);
    return 0;
  }
}

/**
 * 检查设备是否已存在
 */
export async function isDeviceExists(shortKey, deviceId, kv) {
  try {
    const deviceListKey = `link_devices:${shortKey}`;
    const deviceListStr = await kv.get(deviceListKey);
    
    if (!deviceListStr) {
      return false;
    }
    
    const deviceList = JSON.parse(deviceListStr);
    return deviceList.includes(deviceId);
  } catch (error) {
    console.error('Error checking device exists:', error);
    return false;
  }
}

/**
 * 添加设备到链接的设备列表
 */
export async function addDeviceToLink(shortKey, deviceId, kv) {
  try {
    const deviceListKey = `link_devices:${shortKey}`;
    const deviceListStr = await kv.get(deviceListKey);
    
    let deviceList = [];
    if (deviceListStr) {
      deviceList = JSON.parse(deviceListStr);
    }
    
    if (!deviceList.includes(deviceId)) {
      deviceList.push(deviceId);
      await kv.put(deviceListKey, JSON.stringify(deviceList), {
        expirationTtl: 30 * 24 * 60 * 60 // 30天
      });
    }
  } catch (error) {
    console.error('Error adding device to link:', error);
  }
}

/**
 * 生成Mock节点响应（用于非允许国家的访问）
 */
export function generateMockNodeResponse(country, countryName) {
  const mockNode = {
    name: `请使用${countryName || country}节点访问本订阅`,
    type: 'ss',
    server: '127.0.0.1',
    port: 8080,
    cipher: 'aes-256-gcm',
    password: 'mock-password',
    udp: true,
    remark: `当前节点: ${countryName || country} - 请切换到允许的国家节点`
  };
  
  return {
    proxies: [mockNode],
    proxyGroups: [
      {
        name: 'PROXY',
        type: 'select',
        proxies: [mockNode.name]
      }
    ],
    rules: [
      'DOMAIN-SUFFIX,local,PROXY',
      'IP-CIDR,127.0.0.0/8,PROXY',
      'GEOIP,CN,DIRECT',
      'MATCH,PROXY'
    ]
  };
}

/**
 * 检测代理工具
 */
function detectProxyTool(userAgent) {
  const ua = userAgent.toLowerCase();
  
  const proxyPatterns = [
    'clash', 'v2ray', 'quantumult', 'surge',
    'shadowrocket', 'loon', 'stash', 'sing-box',
    'hysteria', 'trojan', 'ssr', 'ss'
  ];
  
  return proxyPatterns.some(pattern => ua.includes(pattern));
}

/**
 * 访问限制检查
 */
export async function checkVisitLimits(linkData, deviceInfo, ipAddress, kv) {
  const limits = linkData.visitLimits || {};
  const violations = [];
  
  // 检查总访问次数限制
  if (limits.total && linkData.totalVisits >= limits.total) {
    violations.push({
      type: 'total_limit',
      message: '已达访问次数限制',
      limit: limits.total,
      current: linkData.totalVisits
    });
  }
  
  // 检查设备访问次数限制
  if (limits.perDevice) {
    const deviceKey = `device:${linkData.shortKey}:${deviceInfo.deviceId}`;
    const deviceVisits = await getDeviceVisits(kv, deviceKey);
    
    if (deviceVisits >= limits.perDevice) {
      violations.push({
        type: 'device_limit',
        message: '已达访问次数限制',
        limit: limits.perDevice,
        current: deviceVisits,
        deviceId: deviceInfo.deviceId
      });
    }
  }
  
  // 检查IP访问次数限制
  if (limits.perIP) {
    const ipKey = `ip:${linkData.shortKey}:${ipAddress}`;
    const ipVisits = await getIPVisits(kv, ipKey);
    
    if (ipVisits >= limits.perIP) {
      violations.push({
        type: 'ip_limit',
        message: '已达访问次数限制',
        limit: limits.perIP,
        current: ipVisits,
        ip: ipAddress
      });
    }
  }
  
  // 检查设备+IP组合限制
  if (limits.perDeviceIP) {
    const deviceIPKey = `deviceip:${linkData.shortKey}:${deviceInfo.deviceId}:${ipAddress}`;
    const deviceIPVisits = await getDeviceIPVisits(kv, deviceIPKey);
    
    if (deviceIPVisits >= limits.perDeviceIP) {
      violations.push({
        type: 'device_ip_limit',
        message: '已达访问次数限制',
        limit: limits.perDeviceIP,
        current: deviceIPVisits,
        deviceId: deviceInfo.deviceId,
        ip: ipAddress
      });
    }
  }
  
  return {
    allowed: violations.length === 0,
    violations
  };
}

/**
 * 记录访问信息
 */
export async function recordVisit(linkData, deviceInfo, ipAddress, kv) {
  const timestamp = getCurrentTimestamp();
  
  // 记录设备访问
  if (linkData.visitLimits?.perDevice) {
    const deviceKey = `device:${linkData.shortKey}:${deviceInfo.deviceId}`;
    await incrementCounter(kv, deviceKey, linkData.visitLimits.perDevice * 2); // 保留2倍限制的缓存
  }
  
  // 记录IP访问
  if (linkData.visitLimits?.perIP) {
    const ipKey = `ip:${linkData.shortKey}:${ipAddress}`;
    await incrementCounter(kv, ipKey, linkData.visitLimits.perIP * 2);
  }
  
  // 记录设备+IP组合访问
  if (linkData.visitLimits?.perDeviceIP) {
    const deviceIPKey = `deviceip:${linkData.shortKey}:${deviceInfo.deviceId}:${ipAddress}`;
    await incrementCounter(kv, deviceIPKey, linkData.visitLimits.perDeviceIP * 2);
  }
  
  // 记录详细访问日志
  const visitLog = {
    id: generateUUID(),
    shortKey: linkData.shortKey,
    timestamp,
    deviceInfo,
    ipAddress,
    userAgent: deviceInfo.fingerprint.userAgent,
    riskScore: deviceInfo.riskScore,
    isBlocked: false
  };
  
  await saveVisitLog(kv, visitLog);
  
  return visitLog;
}

/**
 * 检查设备/IP是否被封禁
 */
export async function checkBlocked(deviceInfo, ipAddress, kv) {
  const deviceBlocked = await kv.get(`blocked:device:${deviceInfo.deviceId}`);
  const ipBlocked = await kv.get(`blocked:ip:${ipAddress}`);
  
  return {
    deviceBlocked: !!deviceBlocked,
    ipBlocked: !!ipBlocked,
    deviceBlockReason: deviceBlocked ? JSON.parse(deviceBlocked).reason : null,
    ipBlockReason: ipBlocked ? JSON.parse(ipBlocked).reason : null
  };
}

/**
 * 封禁设备
 */
export async function blockDevice(deviceId, reason, duration = null, kv) {
  const blockData = {
    deviceId,
    reason,
    blockedAt: getCurrentTimestamp(),
    duration,
    expiresAt: duration ? new Date(Date.now() + duration * 1000).toISOString() : null
  };
  
  const key = `blocked:device:${deviceId}`;
  const options = duration ? { expirationTtl: duration } : {};
  
  await kv.put(key, JSON.stringify(blockData), options);
  return blockData;
}

/**
 * 封禁IP
 */
export async function blockIP(ipAddress, reason, duration = null, kv) {
  const blockData = {
    ipAddress,
    reason,
    blockedAt: getCurrentTimestamp(),
    duration,
    expiresAt: duration ? new Date(Date.now() + duration * 1000).toISOString() : null
  };
  
  const key = `blocked:ip:${ipAddress}`;
  const options = duration ? { expirationTtl: duration } : {};
  
  await kv.put(key, JSON.stringify(blockData), options);
  return blockData;
}

/**
 * 解封设备
 */
export async function unblockDevice(deviceId, kv) {
  await kv.delete(`blocked:device:${deviceId}`);
}

/**
 * 解封IP
 */
export async function unblockIP(ipAddress, kv) {
  await kv.delete(`blocked:ip:${ipAddress}`);
}

/**
 * 获取设备访问次数
 */
async function getDeviceVisits(kv, deviceKey) {
  const data = await kv.get(deviceKey);
  return data ? parseInt(data) : 0;
}

/**
 * 获取IP访问次数
 */
async function getIPVisits(kv, ipKey) {
  const data = await kv.get(ipKey);
  return data ? parseInt(data) : 0;
}

/**
 * 获取设备+IP组合访问次数
 */
async function getDeviceIPVisits(kv, deviceIPKey) {
  const data = await kv.get(deviceIPKey);
  return data ? parseInt(data) : 0;
}

/**
 * 增加计数器
 */
async function incrementCounter(kv, key, ttl) {
  const current = await kv.get(key);
  const newValue = current ? parseInt(current) + 1 : 1;
  await kv.put(key, newValue.toString(), { expirationTtl: ttl });
  return newValue;
}

/**
 * 保存访问日志
 */
async function saveVisitLog(kv, visitLog) {
  const key = `visit:${visitLog.shortKey}:${visitLog.id}`;
  await kv.put(key, JSON.stringify(visitLog), { expirationTtl: 30 * 24 * 60 * 60 }); // 保留30天
}

/**
 * 获取访问统计
 */
export async function getVisitStats(shortKey, kv) {
  const { keys } = await kv.list({ prefix: `visit:${shortKey}:` });
  const visits = [];
  
  for (const key of keys.slice(0, 100)) { // 限制返回数量
    const data = await kv.get(key.name);
    if (data) {
      visits.push(JSON.parse(data));
    }
  }
  
  return visits.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

/**
 * 检测异常访问模式
 */
export function detectAnomalies(visitHistory) {
  const anomalies = [];
  
  if (visitHistory.length < 5) return anomalies;
  
  // 检测短时间内大量访问
  const recentVisits = visitHistory.filter(v => 
    Date.now() - new Date(v.timestamp).getTime() < 5 * 60 * 1000 // 5分钟内
  );
  
  if (recentVisits.length > 10) {
    anomalies.push({
      type: 'rapid_visits',
      severity: 'high',
      message: `5分钟内访问${recentVisits.length}次`,
      count: recentVisits.length
    });
  }
  
  // 检测多个不同设备使用相同IP
  const ipGroups = {};
  visitHistory.forEach(visit => {
    if (!ipGroups[visit.ipAddress]) {
      ipGroups[visit.ipAddress] = new Set();
    }
    ipGroups[visit.ipAddress].add(visit.deviceInfo.deviceId);
  });
  
  Object.entries(ipGroups).forEach(([ip, devices]) => {
    if (devices.size > 5) {
      anomalies.push({
        type: 'multiple_devices_same_ip',
        severity: 'medium',
        message: `IP ${ip} 关联了 ${devices.size} 个不同设备`,
        ip,
        deviceCount: devices.size
      });
    }
  });
  
  // 检测高风险设备
  const highRiskVisits = visitHistory.filter(v => v.riskScore > 70);
  if (highRiskVisits.length > 3) {
    anomalies.push({
      type: 'high_risk_devices',
      severity: 'high',
      message: `检测到 ${highRiskVisits.length} 次高风险访问`,
      count: highRiskVisits.length
    });
  }
  
  return anomalies;
}
