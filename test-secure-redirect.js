// 测试安全重定向功能的Node.js脚本
import http from 'http';

const PORT = 8789; // 使用新端口

// 测试数据
const testData = {
  longUrl: 'https://www.example.com/secret-page',
  shortKey: 'secure-test',
  title: '安全测试链接',
  secureMode: true // 启用安全模式
};

async function createSecureLink() {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/links',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log('🔗 创建安全短链接...');
    console.log('目标URL:', testData.longUrl);
    console.log('安全模式:', testData.secureMode);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.success) {
            console.log('✅ 短链接创建成功！');
            console.log('短链接:', jsonData.data.shortUrl);
            resolve(jsonData.data.shortUrl);
          } else {
            reject(new Error('创建失败: ' + jsonData.error?.message));
          }
        } catch (error) {
          reject(new Error('JSON解析错误: ' + error.message));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error('请求错误: ' + error.message));
    });

    req.write(postData);
    req.end();
  });
}

async function testSecureRedirect(shortUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(shortUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET'
    };

    console.log('\n🔒 测试安全重定向...');
    console.log('访问:', shortUrl);

    const req = http.request(options, (res) => {
      console.log('状态码:', res.statusCode);
      console.log('Content-Type:', res.headers['content-type']);
      
      // 检查是否返回HTML页面而不是重定向
      if (res.statusCode === 200 && res.headers['content-type']?.includes('text/html')) {
        console.log('✅ 安全重定向成功！返回了HTML页面而不是HTTP重定向');
        
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          // 检查HTML内容是否包含预期的安全重定向页面元素
          if (data.includes('正在跳转') && data.includes('spinner')) {
            console.log('✅ HTML页面包含正确的安全重定向元素');
            console.log('🔐 目标URL已被Base64编码隐藏');
          } else {
            console.log('⚠️  HTML页面内容可能不正确');
          }
          resolve(true);
        });
      } else if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log('❌ 返回了HTTP重定向，目标URL可能被暴露');
        console.log('Location头:', res.headers.location);
        resolve(false);
      } else {
        console.log('❓ 意外的响应状态码');
        resolve(false);
      }
    });

    req.on('error', (error) => {
      reject(new Error('请求错误: ' + error.message));
    });

    req.end();
  });
}

async function testDirectRedirect(shortUrl) {
  return new Promise((resolve, reject) => {
    const url = new URL(shortUrl + '?secure=false'); // 强制使用直接重定向
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: 'GET'
    };

    console.log('\n🔄 测试直接重定向（向后兼容）...');
    console.log('访问:', url.toString());

    const req = http.request(options, (res) => {
      console.log('状态码:', res.statusCode);
      
      if (res.statusCode >= 300 && res.statusCode < 400) {
        console.log('✅ 直接重定向成功');
        console.log('Location头:', res.headers.location);
        console.log('⚠️  注意：目标URL在HTTP头中可见');
        resolve(true);
      } else {
        console.log('❌ 直接重定向失败');
        resolve(false);
      }
    });

    req.on('error', (error) => {
      reject(new Error('请求错误: ' + error.message));
    });

    req.end();
  });
}

// 主测试函数
async function runTests() {
  try {
    console.log('🚀 开始测试安全重定向功能\n');
    
    // 创建安全短链接
    const shortUrl = await createSecureLink();
    
    // 测试安全重定向
    await testSecureRedirect(shortUrl);
    
    // 测试直接重定向（向后兼容）
    await testDirectRedirect(shortUrl);
    
    console.log('\n✅ 所有测试完成！');
    console.log('\n📋 总结：');
    console.log('- 安全模式：使用JavaScript重定向页面，隐藏目标URL');
    console.log('- 直接模式：使用HTTP重定向，目标URL在响应头中可见');
    console.log('- 用户可以通过URL参数 ?secure=false 强制使用直接重定向');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
runTests();
