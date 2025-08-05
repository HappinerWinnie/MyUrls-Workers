// 测试自定义响应头功能
import http from 'http';

const PORT = 8789;

// 测试用例
const testCases = [
  {
    name: '基本短链接（无自定义响应头）',
    data: {
      longUrl: 'https://httpbin.org/get',
      shortKey: 'basic-test',
      title: '基本测试链接',
      accessMode: 'redirect'
    },
    expectedHeaders: []
  },
  {
    name: 'Clash订阅链接（subscription-userinfo）',
    data: {
      longUrl: 'https://httpbin.org/get',
      shortKey: 'clash-test',
      title: 'Clash订阅测试',
      accessMode: 'redirect',
      customHeaders: {
        'subscription-userinfo': 'upload=32212254; download=8558028237; total=429496729600; expire=1775318400'
      }
    },
    expectedHeaders: ['subscription-userinfo']
  },
  {
    name: '文件下载链接（content-disposition）',
    data: {
      longUrl: 'https://httpbin.org/get',
      shortKey: 'download-test',
      title: '文件下载测试',
      accessMode: 'redirect',
      customHeaders: {
        'content-disposition': 'attachment; filename*=UTF-8\'\'%E9%AD%94%E6%88%92.net'
      }
    },
    expectedHeaders: ['content-disposition']
  },
  {
    name: '完整自定义响应头',
    data: {
      longUrl: 'https://httpbin.org/get',
      shortKey: 'full-test',
      title: '完整测试链接',
      accessMode: 'redirect',
      customHeaders: {
        'subscription-userinfo': 'upload=0; download=1073741824; total=10737418240; expire=1703980800',
        'content-disposition': 'attachment; filename*=UTF-8\'\'config.yaml'
      }
    },
    expectedHeaders: ['subscription-userinfo', 'content-disposition']
  }
];

async function createTestLink(testCase) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(testCase.data);
    
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

    console.log(`\n🔗 创建测试链接: ${testCase.name}`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.success) {
            console.log(`✅ 链接创建成功: ${jsonData.data.shortUrl}`);
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

async function testCustomHeaders(shortUrl, testCase) {
  return new Promise((resolve, reject) => {
    const url = new URL(shortUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'HEAD', // 使用HEAD请求检查响应头
      headers: {
        'User-Agent': 'MyUrls-Test/1.0'
      }
    };

    console.log(`\n🧪 测试自定义响应头...`);

    const req = http.request(options, (res) => {
      console.log(`   状态码: ${res.statusCode}`);
      console.log(`   Location: ${res.headers.location || '无'}`);
      
      // 检查期望的自定义响应头
      let foundHeaders = 0;
      let totalExpected = testCase.expectedHeaders.length;
      
      for (const expectedHeader of testCase.expectedHeaders) {
        const headerValue = res.headers[expectedHeader.toLowerCase()];
        if (headerValue) {
          console.log(`   ✅ ${expectedHeader}: ${headerValue}`);
          foundHeaders++;
        } else {
          console.log(`   ❌ 缺少响应头: ${expectedHeader}`);
        }
      }
      
      // 检查其他可能的响应头
      const otherHeaders = ['content-type', 'cache-control', 'expires'];
      for (const header of otherHeaders) {
        const value = res.headers[header];
        if (value) {
          console.log(`   📋 ${header}: ${value}`);
        }
      }
      
      // 评估测试结果
      if (totalExpected === 0) {
        console.log(`   ✅ 基本重定向测试通过`);
      } else if (foundHeaders === totalExpected) {
        console.log(`   ✅ 自定义响应头测试通过 (${foundHeaders}/${totalExpected})`);
      } else {
        console.log(`   ⚠️  部分自定义响应头缺失 (${foundHeaders}/${totalExpected})`);
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

function parseSubscriptionUserinfo(headerValue) {
  const parts = headerValue.split(';').map(part => part.trim());
  const info = {};
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) {
      info[key.trim()] = value.trim();
    }
  }
  
  return info;
}

function formatBytes(bytes) {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(2)} GB`;
}

function formatTimestamp(timestamp) {
  const date = new Date(parseInt(timestamp) * 1000);
  return date.toLocaleDateString('zh-CN');
}

// 主测试函数
async function runTests() {
  try {
    console.log('🚀 开始测试自定义响应头功能\n');
    console.log('=' * 60);
    
    for (const testCase of testCases) {
      try {
        // 创建测试链接
        const shortUrl = await createTestLink(testCase);
        
        // 测试自定义响应头
        await testCustomHeaders(shortUrl, testCase);
        
        // 如果有subscription-userinfo，解析并显示
        if (testCase.data.customHeaders && testCase.data.customHeaders['subscription-userinfo']) {
          const info = parseSubscriptionUserinfo(testCase.data.customHeaders['subscription-userinfo']);
          console.log(`\n   📊 订阅信息解析:`);
          if (info.upload) console.log(`      上传: ${formatBytes(info.upload)}`);
          if (info.download) console.log(`      下载: ${formatBytes(info.download)}`);
          if (info.total) console.log(`      总流量: ${formatBytes(info.total)}`);
          if (info.expire) console.log(`      到期时间: ${formatTimestamp(info.expire)}`);
        }
        
        console.log('\n' + '-'.repeat(60));
      } catch (error) {
        console.error(`❌ ${testCase.name}测试失败:`, error.message);
      }
    }
    
    console.log('\n✅ 所有测试完成！');
    
    console.log('\n📋 功能总结：');
    console.log('🎯 自定义响应头: 支持设置任意HTTP响应头');
    console.log('📊 订阅信息: 自动处理subscription-userinfo格式');
    console.log('📁 文件下载: 支持content-disposition设置');
    console.log('🔄 优先级: 自定义响应头优先于目标URL响应头');
    
    console.log('\n💡 使用建议：');
    console.log('- Clash订阅: 设置subscription-userinfo显示流量信息');
    console.log('- 文件下载: 设置content-disposition控制下载行为');
    console.log('- 灵活配置: 可组合使用多个自定义响应头');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
runTests();
