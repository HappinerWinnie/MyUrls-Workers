// 调试函数 - 检查环境配置
export async function onRequest(context) {
  const { request, env, params } = context;
  
  // 收集调试信息
  const debugInfo = {
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    env: {
      hasLINKS: !!env.LINKS,
      hasADMIN_PASSWORD: !!env.ADMIN_PASSWORD,
      hasREQUIRE_AUTH: !!env.REQUIRE_AUTH,
      hasANALYTICS: !!env.ANALYTICS,
      envKeys: Object.keys(env),
      envValues: {}
    },
    params: params || {},
    context: {
      hasRequest: !!context.request,
      hasEnv: !!context.env,
      hasParams: !!context.params,
      hasWaitUntil: !!context.waitUntil,
      hasPassThroughOnException: !!context.passThroughOnException
    }
  };

  // 安全地获取环境变量值（不暴露敏感信息）
  for (const key of Object.keys(env)) {
    if (key === 'ADMIN_PASSWORD') {
      debugInfo.env.envValues[key] = env[key] ? '[HIDDEN]' : 'undefined';
    } else if (key === 'LINKS') {
      debugInfo.env.envValues[key] = env[key] ? '[KV_NAMESPACE_OBJECT]' : 'undefined';
    } else {
      debugInfo.env.envValues[key] = env[key];
    }
  }

  // 如果 LINKS 存在，测试 KV 操作
  if (env.LINKS) {
    try {
      // 测试写入
      await env.LINKS.put('debug-test', JSON.stringify({
        message: 'Debug test successful',
        timestamp: new Date().toISOString()
      }));
      
      // 测试读取
      const testData = await env.LINKS.get('debug-test');
      debugInfo.kvTest = {
        writeSuccess: true,
        readSuccess: !!testData,
        readData: testData ? JSON.parse(testData) : null
      };
      
      // 测试列表
      const listResult = await env.LINKS.list({ limit: 5 });
      debugInfo.kvTest.listSuccess = !!listResult;
      debugInfo.kvTest.listKeys = listResult ? listResult.keys.map(k => k.name) : [];
      
    } catch (error) {
      debugInfo.kvTest = {
        error: error.message,
        stack: error.stack
      };
    }
  } else {
    debugInfo.kvTest = {
      error: 'LINKS KV namespace not available'
    };
  }

  return new Response(JSON.stringify(debugInfo, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie'
    }
  });
}
