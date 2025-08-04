// 测试不同访问模式的Node.js脚本
import http from 'http';

const PORT = 8789;

// 测试不同访问模式
const testCases = [
  {
    name: '直接跳转模式',
    data: {
      longUrl: 'https://www.example.com/redirect-test',
      shortKey: 'redirect-test',
      title: '直接跳转测试',
      accessMode: 'redirect'
    }
  },
  {
    name: 'iframe嵌入模式',
    data: {
      longUrl: 'https://www.example.com/iframe-test',
      shortKey: 'iframe-test',
      title: 'iframe嵌入测试',
      accessMode: 'iframe'
    }
  },
  {
    name: '代理访问模式',
    data: {
      longUrl: 'https://www.example.com/proxy-test',
      shortKey: 'proxy-test',
      title: '代理访问测试',
      accessMode: 'proxy'
    }
  }
];

async function createLink(testCase) {
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

    console.log(`\n🔗 创建${testCase.name}...`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.success) {
            console.log(`✅ ${testCase.name}创建成功！`);
            console.log(`   短链接: ${jsonData.data.shortUrl}`);
            console.log(`   访问模式: ${testCase.data.accessMode}`);
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

async function testAccess(shortUrl, modeName) {
  return new Promise((resolve, reject) => {
    const url = new URL(shortUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET'
    };

    console.log(`\n🔍 测试${modeName}访问...`);

    const req = http.request(options, (res) => {
      console.log(`   状态码: ${res.statusCode}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);
      
      if (res.headers.location) {
        console.log(`   ⚠️  Location头: ${res.headers.location}`);
        console.log(`   🔓 目标URL在HTTP头中暴露`);
      } else {
        console.log(`   ✅ 无Location头，目标URL未在HTTP响应中暴露`);
      }
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        // 检查HTML内容是否包含目标URL
        if (data.includes('example.com')) {
          console.log(`   ⚠️  HTML内容包含目标域名`);
        } else {
          console.log(`   ✅ HTML内容未直接暴露目标域名`);
        }
        
        // 分析安全性
        if (res.statusCode >= 300 && res.statusCode < 400) {
          console.log(`   🔴 安全级别: 低 - HTTP重定向暴露目标URL`);
        } else if (data.includes('iframe') && data.includes('example.com')) {
          console.log(`   🟡 安全级别: 中 - iframe src暴露目标URL`);
        } else if (data.includes('example.com')) {
          console.log(`   🟡 安全级别: 中 - HTML中包含目标URL`);
        } else {
          console.log(`   🟢 安全级别: 高 - 目标URL完全隐藏`);
        }
        
        resolve(true);
      });
    });

    req.on('error', (error) => {
      reject(new Error(`请求错误: ${error.message}`));
    });

    req.end();
  });
}

// 主测试函数
async function runTests() {
  try {
    console.log('🚀 开始测试不同访问模式的安全性\n');
    console.log('=' * 50);
    
    for (const testCase of testCases) {
      try {
        // 创建短链接
        const shortUrl = await createLink(testCase);
        
        // 测试访问
        await testAccess(shortUrl, testCase.name);
        
        console.log('\n' + '-'.repeat(50));
      } catch (error) {
        console.error(`❌ ${testCase.name}测试失败:`, error.message);
      }
    }
    
    console.log('\n✅ 所有测试完成！');
    console.log('\n📋 安全性总结：');
    console.log('🔴 直接跳转: HTTP重定向，目标URL完全暴露');
    console.log('🟡 iframe嵌入: HTML源码中包含目标URL');
    console.log('🟢 代理访问: 目标URL完全隐藏（生产环境）');
    
    console.log('\n💡 建议：');
    console.log('- 公开链接：使用直接跳转');
    console.log('- 一般保护：使用iframe嵌入');
    console.log('- 高度机密：使用代理访问');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
runTests();
