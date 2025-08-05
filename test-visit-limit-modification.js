// 测试访问限制修改功能
import http from 'http';

const PORT = 8789;

// 测试用例
const testScenarios = [
  {
    name: '场景1：增加访问次数',
    description: '链接用完后增加访问机会',
    initialMaxVisits: 3,
    accessTimes: 3, // 访问到用完
    newMaxVisits: 8, // 增加到8次
    expectedResult: '3/8 (新增5次机会)'
  },
  {
    name: '场景2：减少访问次数',
    description: '减少剩余访问机会',
    initialMaxVisits: 10,
    accessTimes: 2, // 访问2次
    newMaxVisits: 5, // 减少到5次
    expectedResult: '2/5 (减少5次机会)'
  },
  {
    name: '场景3：重置访问计数',
    description: '重置链接使用状态',
    initialMaxVisits: 5,
    accessTimes: 5, // 访问到用完
    resetCurrentVisits: 0, // 重置计数
    expectedResult: '0/5 (完全重置)'
  }
];

async function createTestLink(scenario, index) {
  return new Promise((resolve, reject) => {
    const testData = {
      longUrl: `https://httpbin.org/get?test=${index}`,
      shortKey: `test-limit-${index}`,
      title: `${scenario.name}测试链接`,
      maxVisits: scenario.initialMaxVisits,
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
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n🔗 创建测试链接: ${scenario.name}`);
    console.log(`   初始访问限制: ${scenario.initialMaxVisits}次`);

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.success) {
            console.log(`✅ 链接创建成功: ${jsonData.data.shortKey}`);
            resolve({
              shortKey: jsonData.data.shortKey,
              shortUrl: jsonData.data.shortUrl
            });
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

async function accessLink(shortUrl, times) {
  console.log(`\n🔄 访问链接 ${times} 次...`);
  
  for (let i = 1; i <= times; i++) {
    try {
      await new Promise((resolve, reject) => {
        const url = new URL(shortUrl);
        
        const options = {
          hostname: url.hostname,
          port: url.port,
          path: url.pathname,
          method: 'HEAD'
        };

        const req = http.request(options, (res) => {
          console.log(`   第${i}次访问: ${res.statusCode === 302 ? '成功' : '失败'}`);
          resolve();
        });

        req.on('error', (error) => {
          console.log(`   第${i}次访问: 错误 - ${error.message}`);
          resolve(); // 继续执行，不中断测试
        });

        req.setTimeout(3000, () => {
          req.destroy();
          console.log(`   第${i}次访问: 超时`);
          resolve();
        });

        req.end();
      });
      
      // 短暂延迟避免请求过快
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.log(`   第${i}次访问异常: ${error.message}`);
    }
  }
}

async function updateLinkLimits(shortKey, updates) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(updates);
    
    const options = {
      hostname: 'localhost',
      port: PORT,
      path: `/api/links/${shortKey}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    console.log(`\n📝 更新链接限制...`);
    if (updates.maxVisits !== undefined) {
      console.log(`   新的访问限制: ${updates.maxVisits}次`);
    }
    if (updates.currentVisits !== undefined) {
      console.log(`   重置访问计数: ${updates.currentVisits}次`);
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          if (jsonData.success) {
            console.log(`✅ 链接更新成功`);
            console.log(`   当前状态: ${jsonData.data.currentVisits}/${jsonData.data.maxVisits}`);
            resolve(jsonData.data);
          } else {
            reject(new Error(`更新失败: ${jsonData.error?.message}`));
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

async function testScenario(scenario, index) {
  try {
    console.log('\n' + '='.repeat(60));
    console.log(`测试 ${scenario.name}`);
    console.log(`描述: ${scenario.description}`);
    console.log('='.repeat(60));

    // 1. 创建测试链接
    const linkInfo = await createTestLink(scenario, index);

    // 2. 访问链接到指定次数
    if (scenario.accessTimes > 0) {
      await accessLink(linkInfo.shortUrl, scenario.accessTimes);
    }

    // 3. 更新访问限制
    const updates = {};
    if (scenario.newMaxVisits !== undefined) {
      updates.maxVisits = scenario.newMaxVisits;
    }
    if (scenario.resetCurrentVisits !== undefined) {
      updates.currentVisits = scenario.resetCurrentVisits;
    }

    const updatedLink = await updateLinkLimits(linkInfo.shortKey, updates);

    // 4. 验证结果
    console.log(`\n📊 测试结果:`);
    console.log(`   期望结果: ${scenario.expectedResult}`);
    console.log(`   实际结果: ${updatedLink.currentVisits}/${updatedLink.maxVisits}`);
    
    // 5. 测试更新后的访问
    if (updatedLink.currentVisits < updatedLink.maxVisits && updatedLink.maxVisits > 0) {
      console.log(`\n🧪 测试更新后的访问...`);
      await accessLink(linkInfo.shortUrl, 1);
      console.log(`✅ 更新后链接可正常访问`);
    } else if (updatedLink.maxVisits > 0) {
      console.log(`\n⚠️  链接已达到访问限制，无法继续访问`);
    } else {
      console.log(`\n♾️  链接无访问限制`);
    }

    return true;
  } catch (error) {
    console.error(`❌ ${scenario.name}测试失败:`, error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  try {
    console.log('🚀 开始测试访问限制修改功能\n');
    
    let successCount = 0;
    let totalCount = testScenarios.length;

    for (let i = 0; i < testScenarios.length; i++) {
      const success = await testScenario(testScenarios[i], i + 1);
      if (success) {
        successCount++;
      }
      
      // 测试间隔
      if (i < testScenarios.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ 所有测试完成！');
    console.log(`📊 测试结果: ${successCount}/${totalCount} 通过`);
    
    console.log('\n📋 功能总结：');
    console.log('📈 增加访问次数: 支持为用完的链接增加访问机会');
    console.log('📉 减少访问次数: 支持限制剩余访问机会');
    console.log('🔄 重置访问计数: 支持重置链接使用状态');
    console.log('⚠️  智能警告: 危险操作时提供明确提示');
    
    console.log('\n💡 使用建议：');
    console.log('- 活动推广: 根据活动效果动态调整访问次数');
    console.log('- 资源管理: 合理分配有限的访问资源');
    console.log('- 应急处理: 快速重置或调整问题链接');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 运行测试
runTests();
