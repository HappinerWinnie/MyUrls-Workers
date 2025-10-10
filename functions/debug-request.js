// 调试请求信息 - 打印所有可用的请求数据
import { successResponse, errorResponse } from './utils/response.js';

export async function onRequest(context) {
  const { request, env } = context;
  
  try {
    // 收集所有可用的请求信息
    const requestInfo = {
      // 基本信息
      method: request.method,
      url: request.url,
      headers: {},
      
      // 代理工具检测
      isProxyTool: false,
      proxyToolType: 'Unknown',
      proxyToolFeatures: {},
      
      // 原始请求头（完整记录）
      rawHeaders: {},
      
      // 请求头信息
      userAgent: request.headers.get('User-Agent'),
      acceptLanguage: request.headers.get('Accept-Language'),
      acceptEncoding: request.headers.get('Accept-Encoding'),
      accept: request.headers.get('Accept'),
      connection: request.headers.get('Connection'),
      cacheControl: request.headers.get('Cache-Control'),
      referer: request.headers.get('Referer'),
      origin: request.headers.get('Origin'),
      
      // 现代浏览器特征头
      secFetchSite: request.headers.get('Sec-Fetch-Site'),
      secFetchMode: request.headers.get('Sec-Fetch-Mode'),
      secFetchDest: request.headers.get('Sec-Fetch-Dest'),
      secFetchUser: request.headers.get('Sec-Fetch-User'),
      
      // Chrome客户端提示头
      secChUa: request.headers.get('Sec-Ch-Ua'),
      secChUaMobile: request.headers.get('Sec-Ch-Ua-Mobile'),
      secChUaPlatform: request.headers.get('Sec-Ch-Ua-Platform'),
      secChUaPlatformVersion: request.headers.get('Sec-Ch-Ua-Platform-Version'),
      secChUaArch: request.headers.get('Sec-Ch-Ua-Arch'),
      secChUaModel: request.headers.get('Sec-Ch-Ua-Model'),
      secChUaBitness: request.headers.get('Sec-Ch-Ua-Bitness'),
      secChUaFullVersion: request.headers.get('Sec-Ch-Ua-Full-Version'),
      secChUaFullVersionList: request.headers.get('Sec-Ch-Ua-Full-Version-List'),
      secChUaWOW64: request.headers.get('Sec-Ch-Ua-WOW64'),
      secChUaFormFactor: request.headers.get('Sec-Ch-Ua-Form-Factor'),
      secChUaViewportWidth: request.headers.get('Sec-Ch-Ua-Viewport-Width'),
      secChUaViewportHeight: request.headers.get('Sec-Ch-Ua-Viewport-Height'),
      
      // 其他浏览器特征
      dnt: request.headers.get('DNT'),
      upgradeInsecureRequests: request.headers.get('Upgrade-Insecure-Requests'),
      saveData: request.headers.get('Save-Data'),
      
      // 自定义头（可能由客户端发送）
      xScreenResolution: request.headers.get('X-Screen-Resolution'),
      xViewportWidth: request.headers.get('X-Viewport-Width'),
      xViewportHeight: request.headers.get('X-Viewport-Height'),
      xDevicePixelRatio: request.headers.get('X-Device-Pixel-Ratio'),
      xColorDepth: request.headers.get('X-Color-Depth'),
      xPixelDepth: request.headers.get('X-Pixel-Depth'),
      xTimezone: request.headers.get('X-Timezone'),
      xCanvasFingerprint: request.headers.get('X-Canvas-Fingerprint'),
      xWebGLFingerprint: request.headers.get('X-WebGL-Fingerprint'),
      xWebGLVendor: request.headers.get('X-WebGL-Vendor'),
      xWebGLRenderer: request.headers.get('X-WebGL-Renderer'),
      xWebGLVersion: request.headers.get('X-WebGL-Version'),
      xFonts: request.headers.get('X-Fonts'),
      xPlugins: request.headers.get('X-Plugins'),
      
      // Cloudflare特有头
      cfTimezone: request.headers.get('CF-Timezone'),
      cfCountry: request.headers.get('CF-IPCountry'),
      cfCity: request.headers.get('CF-IPCity'),
      cfRegion: request.headers.get('CF-IPRegion'),
      cfLatitude: request.headers.get('CF-IPLatitude'),
      cfLongitude: request.headers.get('CF-IPLongitude'),
      cfConnectingIP: request.headers.get('CF-Connecting-IP'),
      cfRay: request.headers.get('CF-Ray'),
      cfVisitor: request.headers.get('CF-Visitor'),
      cfCacheStatus: request.headers.get('CF-Cache-Status'),
      
      // 安全相关头
      xForwardedFor: request.headers.get('X-Forwarded-For'),
      xRealIP: request.headers.get('X-Real-IP'),
      xRequestedWith: request.headers.get('X-Requested-With'),
      xCSRFToken: request.headers.get('X-CSRF-Token'),
      
      // 其他可能存在的头
      host: request.headers.get('Host'),
      userAgent: request.headers.get('User-Agent'),
      acceptCharset: request.headers.get('Accept-Charset'),
      acceptDatetime: request.headers.get('Accept-Datetime'),
      authorization: request.headers.get('Authorization'),
      cookie: request.headers.get('Cookie'),
      expect: request.headers.get('Expect'),
      from: request.headers.get('From'),
      ifMatch: request.headers.get('If-Match'),
      ifModifiedSince: request.headers.get('If-Modified-Since'),
      ifNoneMatch: request.headers.get('If-None-Match'),
      ifRange: request.headers.get('If-Range'),
      ifUnmodifiedSince: request.headers.get('If-Unmodified-Since'),
      maxForwards: request.headers.get('Max-Forwards'),
      proxyAuthorization: request.headers.get('Proxy-Authorization'),
      range: request.headers.get('Range'),
      te: request.headers.get('TE'),
      upgrade: request.headers.get('Upgrade'),
      via: request.headers.get('Via'),
      warning: request.headers.get('Warning')
    };
    
    // 遍历所有请求头，原封不动地记录
    const allHeaders = {};
    const rawHeaders = {};
    for (const [key, value] of request.headers.entries()) {
      allHeaders[key] = value;
      rawHeaders[key] = value;
    }
    
    // 将原始请求头添加到requestInfo
    requestInfo.rawHeaders = rawHeaders;
    
    // 检测代理工具
    const proxyDetection = detectProxyTool(request);
    requestInfo.isProxyTool = proxyDetection.isProxyTool;
    requestInfo.proxyToolType = proxyDetection.toolType;
    requestInfo.proxyToolFeatures = proxyDetection.features;
    
    // 获取请求体信息（如果是POST请求）
    let bodyInfo = null;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
      try {
        const contentType = request.headers.get('Content-Type');
        if (contentType && contentType.includes('application/json')) {
          const body = await request.json();
          bodyInfo = {
            type: 'JSON',
            size: JSON.stringify(body).length,
            data: body
          };
        } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await request.formData();
          bodyInfo = {
            type: 'FormData',
            size: formData.toString().length,
            data: Object.fromEntries(formData.entries())
          };
        } else {
          const text = await request.text();
          bodyInfo = {
            type: 'Text',
            size: text.length,
            data: text.substring(0, 500) // 只显示前500个字符
          };
        }
      } catch (e) {
        bodyInfo = {
          type: 'Error',
          error: e.message
        };
      }
    }
    
    // 获取Cloudflare环境信息
    const cfInfo = {
      country: request.cf?.country,
      city: request.cf?.city,
      region: request.cf?.region,
      latitude: request.cf?.latitude,
      longitude: request.cf?.longitude,
      timezone: request.cf?.timezone,
      postalCode: request.cf?.postalCode,
      metroCode: request.cf?.metroCode,
      regionCode: request.cf?.regionCode,
      asn: request.cf?.asn,
      asOrganization: request.cf?.asOrganization,
      colo: request.cf?.colo,
      httpProtocol: request.cf?.httpProtocol,
      requestPriority: request.cf?.requestPriority,
      tlsVersion: request.cf?.tlsVersion,
      tlsCipher: request.cf?.tlsCipher,
      tlsClientAuth: request.cf?.tlsClientAuth,
      edgeRequestKeepAliveStatus: request.cf?.edgeRequestKeepAliveStatus,
      edgeRequestKeepAliveStatus: request.cf?.edgeRequestKeepAliveStatus
    };
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      requestInfo,
      allHeaders,
      bodyInfo,
      cfInfo,
      // 统计信息
      stats: {
        totalHeaders: Object.keys(allHeaders).length,
        nonEmptyHeaders: Object.entries(allHeaders).filter(([k, v]) => v && v.trim()).length,
        modernBrowserHeaders: Object.entries(allHeaders).filter(([k, v]) => 
          k.startsWith('Sec-') || k.startsWith('Sec-Ch-')
        ).length,
        customHeaders: Object.entries(allHeaders).filter(([k, v]) => 
          k.startsWith('X-')
        ).length,
        cloudflareHeaders: Object.entries(allHeaders).filter(([k, v]) => 
          k.startsWith('CF-')
        ).length
      }
    };
    
    // 记录访问日志到KV存储
    await recordAccessLog(debugInfo, env);
    
    return successResponse(debugInfo);
    
  } catch (error) {
    return errorResponse(`调试请求失败: ${error.message}`, 500);
  }
}

/**
 * 记录访问日志到KV存储
 */
async function recordAccessLog(debugInfo, env) {
  try {
    if (!env.LINKS) return; // 如果没有KV存储，跳过记录
    
    const kv = env.LINKS;
    const logId = `access_log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // 创建访问日志记录
    const accessLog = {
      id: logId,
      timestamp: debugInfo.timestamp,
      method: debugInfo.requestInfo.method,
      url: debugInfo.requestInfo.url,
      userAgent: debugInfo.requestInfo.userAgent,
      isProxyTool: debugInfo.requestInfo.isProxyTool,
      proxyToolType: debugInfo.requestInfo.proxyToolType,
      headers: debugInfo.requestInfo.rawHeaders,
      cfInfo: debugInfo.cfInfo,
      stats: debugInfo.stats,
      // 原始调试信息（完整记录）
      fullDebugInfo: debugInfo
    };
    
    // 保存到KV存储，设置7天过期
    await kv.put(`access_log:${logId}`, JSON.stringify(accessLog), {
      expirationTtl: 7 * 24 * 60 * 60 // 7天
    });
    
    // 更新访问统计
    await updateAccessStats(kv, debugInfo);
    
  } catch (error) {
    console.error('记录访问日志失败:', error);
  }
}

/**
 * 更新访问统计
 */
async function updateAccessStats(kv, debugInfo) {
  try {
    const statsKey = 'access_stats';
    let stats = await kv.get(statsKey);
    
    if (!stats) {
      stats = {
        total: 0,
        proxy: 0,
        browser: 0,
        unknown: 0,
        lastUpdated: new Date().toISOString()
      };
    } else {
      stats = JSON.parse(stats);
    }
    
    stats.total++;
    
    if (debugInfo.requestInfo.isProxyTool) {
      stats.proxy++;
    } else if (debugInfo.requestInfo.userAgent && (
      debugInfo.requestInfo.userAgent.includes('Mozilla') || 
      debugInfo.requestInfo.userAgent.includes('Chrome') || 
      debugInfo.requestInfo.userAgent.includes('Firefox') || 
      debugInfo.requestInfo.userAgent.includes('Safari')
    )) {
      stats.browser++;
    } else {
      stats.unknown++;
    }
    
    stats.lastUpdated = new Date().toISOString();
    
    // 保存统计信息
    await kv.put(statsKey, JSON.stringify(stats), {
      expirationTtl: 30 * 24 * 60 * 60 // 30天
    });
    
  } catch (error) {
    console.error('更新访问统计失败:', error);
  }
}

/**
 * 检测代理工具
 */
function detectProxyTool(request) {
  const userAgent = request.headers.get('User-Agent') || '';
  const ua = userAgent.toLowerCase();
  
  // 代理工具特征检测
  const proxyTools = {
    'Clash': {
      patterns: ['clash', 'clashmeta', 'clash-verge', 'clashx'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'V2Ray': {
      patterns: ['v2ray', 'v2rayng', 'v2rayu', 'v2rayn'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Quantumult': {
      patterns: ['quantumult', 'quantumultx'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Surge': {
      patterns: ['surge', 'surge4'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Shadowrocket': {
      patterns: ['shadowrocket'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Loon': {
      patterns: ['loon'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Stash': {
      patterns: ['stash'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Sing-Box': {
      patterns: ['sing-box', 'singbox'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Hysteria': {
      patterns: ['hysteria'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'Trojan': {
      patterns: ['trojan'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'SSR': {
      patterns: ['ssr', 'shadowsocksr'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    },
    'SS': {
      patterns: ['shadowsocks', 'ss-'],
      features: {
        hasCustomHeaders: false,
        hasProxyHeaders: false,
        hasCustomUserAgent: false
      }
    }
  };
  
  // 检测代理工具类型
  let detectedTool = null;
  for (const [toolName, toolInfo] of Object.entries(proxyTools)) {
    if (toolInfo.patterns.some(pattern => ua.includes(pattern))) {
      detectedTool = toolName;
      break;
    }
  }
  
  // 分析代理工具特征
  const features = {
    // 自定义请求头检测
    hasCustomHeaders: !!(
      request.headers.get('X-Proxy-Tool') ||
      request.headers.get('X-Client-Name') ||
      request.headers.get('X-Client-Version') ||
      request.headers.get('X-Proxy-Type') ||
      request.headers.get('X-Proxy-Protocol')
    ),
    
    // 代理相关请求头
    hasProxyHeaders: !!(
      request.headers.get('Via') ||
      request.headers.get('X-Forwarded-For') ||
      request.headers.get('X-Real-IP') ||
      request.headers.get('X-Forwarded-Proto') ||
      request.headers.get('X-Forwarded-Host')
    ),
    
    // 自定义User-Agent
    hasCustomUserAgent: !ua.includes('mozilla') && !ua.includes('webkit') && !ua.includes('gecko'),
    
    // 缺少浏览器特征
    missingBrowserFeatures: !(
      request.headers.get('Sec-Fetch-Site') ||
      request.headers.get('Sec-Fetch-Mode') ||
      request.headers.get('Sec-Ch-Ua') ||
      request.headers.get('Upgrade-Insecure-Requests')
    ),
    
    // 请求头数量异常
    headerCount: Array.from(request.headers.keys()).length,
    isLowHeaderCount: Array.from(request.headers.keys()).length < 5,
    
    // 特定代理工具特征
    hasClashHeaders: !!(
      request.headers.get('X-Clash-Config') ||
      request.headers.get('X-Clash-Mode') ||
      request.headers.get('X-Clash-Proxy')
    ),
    
    hasV2RayHeaders: !!(
      request.headers.get('X-V2Ray-Config') ||
      request.headers.get('X-V2Ray-Protocol') ||
      request.headers.get('X-V2Ray-Transport')
    ),
    
    hasQuantumultHeaders: !!(
      request.headers.get('X-Quantumult-Config') ||
      request.headers.get('X-Quantumult-Mode') ||
      request.headers.get('X-Quantumult-Proxy')
    ),
    
    hasSurgeHeaders: !!(
      request.headers.get('X-Surge-Config') ||
      request.headers.get('X-Surge-Mode') ||
      request.headers.get('X-Surge-Proxy')
    )
  };
  
  // 更新检测到的代理工具特征
  if (detectedTool && proxyTools[detectedTool]) {
    proxyTools[detectedTool].features = features;
  }
  
  return {
    isProxyTool: !!detectedTool,
    toolType: detectedTool || 'Unknown',
    features: features,
    allProxyTools: proxyTools,
    userAgent: userAgent,
    detectedPatterns: detectedTool ? 
      proxyTools[detectedTool].patterns.filter(pattern => ua.includes(pattern)) : []
  };
}
