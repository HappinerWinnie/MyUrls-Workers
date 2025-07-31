// 简单的服务器连接测试
import http from 'http';

console.log('🔍 测试服务器连接...');

const options = {
  hostname: 'localhost',
  port: 8788,
  path: '/',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ 服务器响应状态码: ${res.statusCode}`);
  console.log(`📋 响应头:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📄 响应内容长度: ${data.length} 字符`);
    if (data.includes('<title>')) {
      console.log('✅ 主页加载成功');
    } else {
      console.log('❌ 主页内容异常');
    }
  });
});

req.on('error', (err) => {
  console.error('❌ 连接错误:', err.message);
});

req.end();
