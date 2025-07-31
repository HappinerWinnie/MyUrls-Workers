// 测试API的Node.js脚本
import http from 'http';

const testData = {
  longUrl: 'https://www.example.com',
  shortKey: 'test123',
  password: 'mypassword',
  title: '测试密码链接'
};

const postData = JSON.stringify(testData);

const options = {
  hostname: 'localhost',
  port: 8788,
  path: '/api/links',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('发送请求到:', `http://${options.hostname}:${options.port}${options.path}`);
console.log('请求数据:', testData);

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log(`响应头:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('响应数据:', data);
    try {
      const jsonData = JSON.parse(data);
      console.log('解析后的响应:', JSON.stringify(jsonData, null, 2));
      
      if (jsonData.success) {
        console.log('\n✅ 短链接创建成功！');
        console.log('短链接:', jsonData.data.shortUrl);
        console.log('密码: mypassword');
        console.log('\n现在可以测试访问:', jsonData.data.shortUrl);
      }
    } catch (error) {
      console.log('JSON解析错误:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.error('请求错误:', error);
});

req.write(postData);
req.end();
