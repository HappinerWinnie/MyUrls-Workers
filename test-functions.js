// 直接测试 Functions 功能
import http from 'http';

console.log('🧪 开始测试 MyUrls 功能');
console.log('================================');

const baseUrl = 'http://localhost:8788';

// 辅助函数：发送 HTTP 请求
function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const result = {
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            data: body ? JSON.parse(body) : null
          };
          resolve(result);
        } catch (e) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body: body,
            data: null
          });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(data);
    }
    req.end();
  });
}

async function testAPI() {
  try {
    // 测试 1: 创建基本短链接
    console.log('\n📝 测试 1: 创建基本短链接');
    const createOptions1 = {
      hostname: 'localhost',
      port: 8788,
      path: '/api/links',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    const createData1 = JSON.stringify({
      longUrl: 'https://www.example.com/test-page',
      title: '测试链接1'
    });

    const result1 = await makeRequest(createOptions1, createData1);
    console.log(`状态码: ${result1.statusCode}`);
    if (result1.data && result1.data.success) {
      console.log('✅ 基本短链接创建成功');
      console.log(`   短链接: ${result1.data.data.shortUrl}`);
      console.log(`   短键: ${result1.data.data.shortKey}`);
    } else {
      console.log('❌ 基本短链接创建失败');
      console.log('   响应:', result1.body);
    }

    // 测试 2: 创建带访问次数限制的短链接（核心功能）
    console.log('\n🎯 测试 2: 创建带访问次数限制的短链接');
    const createData2 = JSON.stringify({
      longUrl: 'https://www.google.com',
      title: '访问限制测试',
      maxVisits: 3
    });

    const result2 = await makeRequest(createOptions1, createData2);
    console.log(`状态码: ${result2.statusCode}`);
    if (result2.data && result2.data.success) {
      console.log('✅ 限制访问短链接创建成功');
      console.log(`   短链接: ${result2.data.data.shortUrl}`);
      console.log(`   短键: ${result2.data.data.shortKey}`);
      console.log(`   访问限制: ${result2.data.data.maxVisits} 次`);
      
      const shortKey = result2.data.data.shortKey;
      
      // 测试访问次数限制
      console.log('\n🔄 测试访问次数限制功能');
      
      for (let i = 1; i <= 4; i++) {
        const accessOptions = {
          hostname: 'localhost',
          port: 8788,
          path: `/${shortKey}`,
          method: 'GET'
        };
        
        try {
          const accessResult = await makeRequest(accessOptions);
          console.log(`第${i}次访问 - 状态码: ${accessResult.statusCode}`);
          
          if (i <= 3) {
            if (accessResult.statusCode === 301 || accessResult.statusCode === 302) {
              console.log(`✅ 第${i}次访问成功 (重定向)`);
            } else {
              console.log(`⚠️  第${i}次访问状态异常`);
            }
          } else {
            if (accessResult.statusCode === 403) {
              console.log('✅ 第4次访问被正确拒绝 (403 Forbidden)');
            } else {
              console.log(`❌ 第4次访问应该被拒绝，但状态码是: ${accessResult.statusCode}`);
            }
          }
        } catch (error) {
          console.log(`第${i}次访问出错:`, error.message);
        }
        
        // 稍微延迟一下
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      console.log('❌ 限制访问短链接创建失败');
      console.log('   响应:', result2.body);
    }

    // 测试 3: 创建自定义别名短链接
    console.log('\n🔗 测试 3: 创建自定义别名短链接');
    const createData3 = JSON.stringify({
      longUrl: 'https://www.github.com',
      shortKey: 'github-test',
      title: 'GitHub官网'
    });

    const result3 = await makeRequest(createOptions1, createData3);
    console.log(`状态码: ${result3.statusCode}`);
    if (result3.data && result3.data.success) {
      console.log('✅ 自定义别名短链接创建成功');
      console.log(`   短链接: ${result3.data.data.shortUrl}`);
      console.log(`   短键: ${result3.data.data.shortKey}`);
    } else {
      console.log('❌ 自定义别名短链接创建失败');
      console.log('   响应:', result3.body);
    }

    console.log('\n🎉 API 测试完成！');

  } catch (error) {
    console.error('测试过程中出错:', error);
  }
}

// 运行测试
testAPI();
