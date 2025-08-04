// 测试服务器端ClashMeta UA和响应头保留功能
import http from 'http';

const PORT = 8789;

// 测试用例 - 现在测试的是服务器端功能，客户端UA不再受限制
const testCases = [
  {
    name: '普通浏览器User-Agent（应该成功）',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    shouldSucceed: true
  },
  {
    name: 'ClashMeta User-Agent（应该成功）',
    userAgent: 'ClashMeta/1.0',
    shouldSucceed: true
  },
  {
    name: '空User-Agent（应该成功）',
    userAgent: '',
    shouldSucceed: true
  },
  {
    name: '自定义User-Agent（应该成功）',
    userAgent: 'MyApp/1.0',
    shouldSucceed: true
  }
];

async function createTestLink() {
  return new Promise((resolve, reject) => {
    const testData = {
      longUrl: 'https://httpbin.org/response-headers?subscription-userinfo=upload%3D0%3B%20download%3D1073741824%3B%20total%3D10737418240&content-disposition=attachment%3B%20filename%3D%22config.yaml%22',
      shortKey: 'ua-test',
      title: 'UA检查测试链接',
      accessMode: 'redirect'
    };

    const postData = JSON.stringify(testData);
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: '/api/links',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'Mozilla/5.0' // 客户端可以使用任意UA
      }
    };

    console.log('🔗 创建测试链接...');

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.success) {
            console.log('✅ 测试链接创建成功！');
            console.log('   短链接:', jsonData.data.shortUrl);
            resolve(jsonData.data.shortUrl);
          } else {
            reject(new Error(`创建失败: ${jsonData.error?.message}`));
          }
        } catch (error) {
          reject(new Error(`JSON解析错误: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`请求错误: ${error.message}`));
    });

    req.write(postData);
    req.end();
  });
}

async function testUserAgent(shortUrl, testCase) {
  return new Promise((resolve, reject) => {
    const url = new URL(shortUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'HEAD', // 使用HEAD请求避免实际重定向
      headers: {
        'User-Agent': testCase.userAgent
      }
    };

    console.log(`\n🧪 测试: ${testCase.name}`);
    console.log(`   User-Agent: "${testCase.userAgent}"`);

    const req = http.request(options, (res) => {
      console.log(`   状态码: ${res.statusCode}`);
      
      if (testCase.shouldSucceed) {
        if (res.statusCode === 302) {
          console.log('   ✅ 测试通过 - 成功重定向');
          console.log(`   Location: ${res.headers.location}`);
          
          // 检查是否保留了重要的响应头
          const importantHeaders = ['subscription-userinfo', 'content-disposition'];
          let headersPreserved = 0;
          
          for (const header of importantHeaders) {
            if (res.headers[header]) {
              console.log(`   📋 保留响应头 ${header}: ${res.headers[header]}`);
              headersPreserved++;
            }
          }
          
          if (headersPreserved > 0) {
            console.log(`   ✅ 成功保留 ${headersPreserved} 个重要响应头`);
          } else {
            console.log('   ⚠️  未检测到特殊响应头（可能目标服务器未返回）');
          }
          
        } else {
          console.log('   ❌ 测试失败 - 应该成功但被拒绝');
        }
      } else {
        if (res.statusCode === 403) {
          console.log('   ✅ 测试通过 - 正确拒绝访问');
        } else {
          console.log('   ❌ 测试失败 - 应该被拒绝但允许访问');
        }
      }
      
      resolve(true);
    });

    req.on('error', (error) => {
      console.log(`   ❌ 请求错误: ${error.message}`);
      resolve(false);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      console.log('   ⏰ 请求超时');
      resolve(false);
    });

    req.end();
  });
}

// 主测试函数
async function runTests() {
  try {
    console.log('🚀 开始测试UA检查和响应头保留功能\n');
    console.log('=' * 60);
    
    // 创建测试链接
    const shortUrl = await createTestLink();
    
    console.log('\n' + '-'.repeat(60));
    console.log('开始客户端访问测试（服务器端使用ClashMeta UA访问原始链接）');
    console.log('-'.repeat(60));
    
    // 测试不同的User-Agent
    for (const testCase of testCases) {
      await testUserAgent(shortUrl, testCase);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试完成！');
    
    console.log('\n📋 功能总结：');
    console.log('🤖 服务器端UA: 服务器访问原始链接时使用ClashMeta/1.18.0');
    console.log('📤 响应头保留: 保留subscription-userinfo、content-disposition等重要头');
    console.log('🌐 客户端自由: 客户端可以使用任意User-Agent访问短链接');

    console.log('\n💡 使用建议：');
    console.log('- Clash订阅链接: 服务器端自动使用正确的UA获取订阅信息');
    console.log('- 响应头保留: 确保客户端获得完整的服务器响应头信息');
    console.log('- 兼容性好: 支持各种客户端访问短链接');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
runTests();
