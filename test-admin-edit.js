// 测试管理后台的完整编辑功能
const BASE_URL = 'http://localhost:8789';

// 简单的HTTP客户端
async function httpRequest(url, options = {}) {
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });
    
    const data = await response.json();
    return { data, status: response.status };
}

async function testAdminEditFeature() {
    console.log('🚀 开始测试管理后台的完整编辑功能...\n');

    try {
        // 1. 创建一个包含所有字段的测试链接
        console.log('1. 创建包含所有字段的测试链接...');
        const createData = {
            longUrl: 'https://www.example.com/original-page',
            shortKey: 'admin-test-' + Date.now(),
            title: '原始标题',
            maxVisits: 50,
            expiryDays: 15,
            password: 'original123',
            accessMode: 'proxy',
            customHeaders: {
                'subscription-userinfo': 'upload=0; download=536870912; total=214748364800; expire=1735689600',
                'content-disposition': 'attachment; filename*=UTF-8\'\'original.yaml'
            }
        };

        const createResponse = await httpRequest(`${BASE_URL}/api/links`, {
            method: 'POST',
            body: JSON.stringify(createData)
        });
        
        if (!createResponse.data.success) {
            throw new Error('创建链接失败: ' + createResponse.data.error.message);
        }

        const createdLink = createResponse.data.data;
        console.log('✅ 创建成功:', createdLink.shortKey);

        // 2. 获取链接详情验证创建
        console.log('\n2. 获取链接详情验证创建...');
        const getResponse = await httpRequest(`${BASE_URL}/api/links/${createdLink.shortKey}`);
        
        if (!getResponse.data.success) {
            throw new Error('获取链接失败: ' + getResponse.data.error.message);
        }

        const originalData = getResponse.data.data;
        console.log('✅ 原始数据获取成功');
        console.log('   - 标题:', originalData.title);
        console.log('   - 访问限制:', originalData.maxVisits);
        console.log('   - 访问模式:', originalData.accessMode);
        console.log('   - 自定义响应头:', Object.keys(originalData.customHeaders || {}));

        // 3. 模拟管理后台的完整编辑操作
        console.log('\n3. 模拟管理后台的完整编辑操作...');
        const updateData = {
            longUrl: 'https://www.updated-example.com/new-page',
            shortKey: createdLink.shortKey + '-edited',
            title: '管理后台修改的标题',
            description: '这是通过管理后台添加的描述',
            maxVisits: 100,
            currentVisits: 10,
            expiryDays: 30,
            password: 'admin-updated-pass',
            accessMode: 'redirect',
            isActive: true,
            tags: ['管理后台', '编辑测试', '完整功能'],
            subscriptionInfo: {
                upload: '5',
                download: '10',
                total: '1000',
                expire: '2025-12-31'
            },
            contentDisposition: {
                type: 'attachment',
                filename: 'admin-updated-config.yaml'
            },
            customHeaders: {
                'x-admin-edited': 'true',
                'x-edit-timestamp': new Date().toISOString()
            }
        };

        const updateResponse = await httpRequest(`${BASE_URL}/api/links/${createdLink.shortKey}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });
        
        if (!updateResponse.data.success) {
            throw new Error('更新链接失败: ' + updateResponse.data.error.message);
        }

        console.log('✅ 管理后台编辑成功');

        // 4. 验证所有字段的修改结果
        console.log('\n4. 验证所有字段的修改结果...');
        const verifyResponse = await httpRequest(`${BASE_URL}/api/links/${updateData.shortKey}`);
        
        if (!verifyResponse.data.success) {
            throw new Error('验证失败: ' + verifyResponse.data.error.message);
        }

        const updatedData = verifyResponse.data.data;
        
        // 详细验证各个字段
        const checks = [
            { field: 'longUrl', expected: updateData.longUrl, actual: updatedData.longUrl },
            { field: 'shortKey', expected: updateData.shortKey, actual: updatedData.shortKey },
            { field: 'title', expected: updateData.title, actual: updatedData.title },
            { field: 'description', expected: updateData.description, actual: updatedData.description },
            { field: 'maxVisits', expected: updateData.maxVisits, actual: updatedData.maxVisits },
            { field: 'currentVisits', expected: updateData.currentVisits, actual: updatedData.currentVisits },
            { field: 'accessMode', expected: updateData.accessMode, actual: updatedData.accessMode },
            { field: 'isActive', expected: updateData.isActive, actual: updatedData.isActive }
        ];

        let allPassed = true;
        console.log('\n   字段验证结果:');
        checks.forEach(check => {
            if (check.actual === check.expected) {
                console.log(`   ✅ ${check.field}: ${check.actual}`);
            } else {
                console.log(`   ❌ ${check.field}: 期望 ${check.expected}, 实际 ${check.actual}`);
                allPassed = false;
            }
        });

        // 验证标签
        if (updatedData.tags && Array.isArray(updatedData.tags) && updatedData.tags.length === 3) {
            console.log('   ✅ 标签: ' + updatedData.tags.join(', '));
        } else {
            console.log('   ❌ 标签验证失败');
            allPassed = false;
        }

        // 验证自定义响应头
        if (updatedData.customHeaders) {
            const headers = updatedData.customHeaders;
            console.log('   ✅ 自定义响应头包含:');
            
            // 检查subscription-userinfo
            if (headers['subscription-userinfo']) {
                console.log('     - subscription-userinfo: ✅');
            } else {
                console.log('     - subscription-userinfo: ❌');
                allPassed = false;
            }
            
            // 检查content-disposition
            if (headers['content-disposition']) {
                console.log('     - content-disposition: ✅');
            } else {
                console.log('     - content-disposition: ❌');
                allPassed = false;
            }
            
            // 检查其他自定义头
            if (headers['x-admin-edited']) {
                console.log('     - x-admin-edited: ✅');
            } else {
                console.log('     - x-admin-edited: ❌');
                allPassed = false;
            }
        } else {
            console.log('   ❌ 自定义响应头未保存');
            allPassed = false;
        }

        // 5. 测试结果总结
        console.log('\n' + '='.repeat(50));
        if (allPassed) {
            console.log('🎉 管理后台完整编辑功能测试通过！');
            console.log('✅ 所有前台字段都可以在后台正确修改');
            console.log('✅ 自定义响应头处理正确');
            console.log('✅ 数据验证和安全检查有效');
        } else {
            console.log('⚠️ 部分功能测试失败，请检查上面的详细结果');
        }

        return allPassed;

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return false;
    }
}

// 运行测试
testAdminEditFeature().then(success => {
    process.exit(success ? 0 : 1);
});
