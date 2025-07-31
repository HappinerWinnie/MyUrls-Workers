// 简单测试函数
export async function onRequest(context) {
  const { request, env } = context;
  
  const response = {
    status: 'OK',
    message: 'Test function is working',
    timestamp: new Date().toISOString(),
    kv_status: env.LINKS ? 'Available' : 'Not configured',
    url: request.url
  };

  return new Response(JSON.stringify(response, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
