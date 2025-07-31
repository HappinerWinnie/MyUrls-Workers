// 简单的 API 测试
import http from 'http';

console.log('🧪 开始测试 MyUrls API 功能');
console.log('================================');

// 测试创建基本短链接
async function testCreateLink() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      longUrl: 'https://www.example.com/test-page',
      title: '测试链接1'
    });

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

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({ statusCode: res.statusCode, data: result });
        } catch (e) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(postData);
    req.end();
  });
}

// 测试访问短链接
async function testAccessLink(shortKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 8788,
      path: `/${shortKey}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      resolve({ statusCode: res.statusCode, headers: res.headers });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.end();
  });
}

// 运行测试
async function runTests() {
  try {
    // 测试 1: 创建基本短链接
    console.log('\n📝 测试 1: 创建基本短链接');
    const result1 = await testCreateLink();
    console.log(`状态码: ${result1.statusCode}`);
    
    if (result1.data && result1.data.success) {
      console.log('✅ 基本短链接创建成功');
      console.log(`   短链接: ${result1.data.data.shortUrl}`);
      console.log(`   短键: ${result1.data.data.shortKey}`);
      
      // 测试访问短链接
      console.log('\n🔗 测试访问短链接');
      const accessResult = await testAccessLink(result1.data.data.shortKey);
      console.log(`访问状态码: ${accessResult.statusCode}`);
      
      if (accessResult.statusCode === 301 || accessResult.statusCode === 302) {
        console.log('✅ 短链接重定向正常');
        console.log(`   重定向到: ${accessResult.headers.location}`);
      } else {
        console.log('❌ 短链接重定向异常');
      }
    } else {
      console.log('❌ 基本短链接创建失败');
      console.log('   响应:', result1.data);
    }

    // 测试 2: 创建带访问次数限制的短链接
    console.log('\n🎯 测试 2: 创建带访问次数限制的短链接');
    const postData2 = JSON.stringify({
      longUrl: 'https://www.google.com',
      title: '访问限制测试',
      maxVisits: 2
    });

    const result2 = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'localhost',
        port: 8788,
        path: '/api/links',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData2)
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
          } catch (e) {
            resolve({ statusCode: res.statusCode, data: data });
          }
        });
      });

      req.on('error', reject);
      req.write(postData2);
      req.end();
    });

    console.log(`状态码: ${result2.statusCode}`);
    
    if (result2.data && result2.data.success) {
      console.log('✅ 限制访问短链接创建成功');
      console.log(`   短链接: ${result2.data.data.shortUrl}`);
      console.log(`   访问限制: ${result2.data.data.maxVisits} 次`);
      
      const shortKey = result2.data.data.shortKey;
      
      // 测试访问次数限制
      console.log('\n🔄 测试访问次数限制功能');
      
      for (let i = 1; i <= 3; i++) {
        const accessResult = await testAccessLink(shortKey);
        console.log(`第${i}次访问 - 状态码: ${accessResult.statusCode}`);
        
        if (i <= 2) {
          if (accessResult.statusCode === 301 || accessResult.statusCode === 302) {
            console.log(`✅ 第${i}次访问成功 (重定向)`);
          } else {
            console.log(`⚠️  第${i}次访问状态异常`);
          }
        } else {
          if (accessResult.statusCode === 403) {
            console.log('✅ 第3次访问被正确拒绝 (403 Forbidden) - 访问次数限制生效！');
          } else {
            console.log(`❌ 第3次访问应该被拒绝，但状态码是: ${accessResult.statusCode}`);
          }
        }
        
        // 稍微延迟
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      console.log('❌ 限制访问短链接创建失败');
      console.log('   响应:', result2.data);
    }

    console.log('\n🎉 API 测试完成！');

  } catch (error) {
    console.error('❌ 测试过程中出错:', error.message);
  }
}

runTests();
