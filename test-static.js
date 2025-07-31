// 测试静态文件访问
import http from 'http';

console.log('🔍 测试静态文件访问...');

const options = {
  hostname: 'localhost',
  port: 8788,
  path: '/test.html',
  method: 'GET'
};

const req = http.request(options, (res) => {
  console.log(`✅ 响应状态码: ${res.statusCode}`);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log(`📄 响应内容长度: ${data.length} 字符`);
    if (data.includes('MyUrls API 测试')) {
      console.log('✅ 测试页面加载成功');
    } else {
      console.log('❌ 测试页面内容异常');
      console.log('前100个字符:', data.substring(0, 100));
    }
  });
});

req.on('error', (err) => {
  console.error('❌ 连接错误:', err.message);
});

req.end();
