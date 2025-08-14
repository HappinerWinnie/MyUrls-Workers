// 直接测试API功能
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

async function testCompleteEditFeature() {
    console.log('🚀 开始测试完整字段修改功能...\n');

    try {
        // 1. 创建测试链接
        console.log('1. 创建包含所有字段的测试链接...');
        const createData = {
            longUrl: 'https://www.example.com/test-page',
            shortKey: 'test-' + Date.now(),
            title: '测试链接标题',
            maxVisits: 100,
            expiryDays: 30,
            password: 'test123',
            accessMode: 'proxy',
            customHeaders: {
                'subscription-userinfo': 'upload=0; download=1073741824; total=429496729600; expire=1735689600',
                'content-disposition': 'attachment; filename*=UTF-8\'\'config.yaml'
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

        // 2. 获取链接详情
        console.log('\n2. 获取链接详情...');
        const getResponse = await httpRequest(`${BASE_URL}/api/links/${createdLink.shortKey}`);

        if (!getResponse.data.success) {
            throw new Error('获取链接失败: ' + getResponse.data.error.message);
        }

        const originalData = getResponse.data.data;
        console.log('✅ 获取成功:', originalData.title);

        // 3. 测试修改所有字段
        console.log('\n3. 测试修改所有字段...');
        const updateData = {
            longUrl: 'https://www.updated-example.com/new-page',
            shortKey: createdLink.shortKey + '-updated',
            title: '更新后的标题',
            description: '更新后的描述',
            maxVisits: 200,
            currentVisits: 5,
            expiryDays: 60,
            password: 'newpass123',
            accessMode: 'redirect',
            isActive: true,
            tags: ['测试', '更新', '完整功能'],
            subscriptionInfo: {
                upload: '2',
                download: '5',
                total: '500',
                expire: '2025-12-31'
            },
            contentDisposition: {
                type: 'attachment',
                filename: 'updated-config.yaml'
            },
            customHeaders: {
                'x-custom-header': 'test-value',
                'x-updated': 'true'
            }
        };

        const updateResponse = await httpRequest(`${BASE_URL}/api/links/${createdLink.shortKey}`, {
            method: 'PUT',
            body: JSON.stringify(updateData)
        });

        if (!updateResponse.data.success) {
            throw new Error('更新链接失败: ' + updateResponse.data.error.message);
        }

        console.log('✅ 更新成功');

        // 4. 验证修改结果
        console.log('\n4. 验证修改结果...');
        const verifyResponse = await httpRequest(`${BASE_URL}/api/links/${updateData.shortKey}`);

        if (!verifyResponse.data.success) {
            throw new Error('验证失败: ' + verifyResponse.data.error.message);
        }

        const updatedData = verifyResponse.data.data;
        
        // 验证各个字段
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
        checks.forEach(check => {
            if (check.actual === check.expected) {
                console.log(`✅ ${check.field}: ${check.actual}`);
            } else {
                console.log(`❌ ${check.field}: 期望 ${check.expected}, 实际 ${check.actual}`);
                allPassed = false;
            }
        });

        // 检查自定义响应头
        if (updatedData.customHeaders) {
            console.log('✅ 自定义响应头已保存:', Object.keys(updatedData.customHeaders));
        } else {
            console.log('❌ 自定义响应头未保存');
            allPassed = false;
        }

        // 检查标签
        if (updatedData.tags && Array.isArray(updatedData.tags)) {
            console.log('✅ 标签已保存:', updatedData.tags);
        } else {
            console.log('❌ 标签未保存');
            allPassed = false;
        }

        if (allPassed) {
            console.log('\n🎉 所有测试通过！完整字段修改功能正常工作。');
        } else {
            console.log('\n⚠️ 部分测试失败，请检查上面的详细结果。');
        }

        return allPassed;

    } catch (error) {
        console.error('❌ 测试失败:', error.message);
        return false;
    }
}

// 运行测试
testCompleteEditFeature().then(success => {
    process.exit(success ? 0 : 1);
});
