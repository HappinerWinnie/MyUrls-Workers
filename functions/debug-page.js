// 调试页面路由
export async function onRequest(context) {
  const { request } = context;
  
  // 返回调试页面HTML
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>请求调试工具</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="/static/browser-fingerprint.js"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold text-gray-800 mb-8">请求调试工具</h1>
            
            <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">测试请求</h2>
                <div class="space-y-4">
                    <button id="test-get" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-4">
                        GET请求测试
                    </button>
                    <button id="test-post" class="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mr-4">
                        POST请求测试
                    </button>
                    <button id="test-with-fingerprint" class="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
                        带指纹的POST请求
                    </button>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">请求结果</h2>
                <div id="request-result" class="space-y-4">
                    <div class="text-gray-500">点击上方按钮开始测试...</div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-xl font-semibold mb-4">统计信息</h2>
                <div id="stats-info" class="space-y-2">
                    <!-- 统计信息将在这里显示 -->
                </div>
            </div>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.getElementById('test-get').addEventListener('click', () => testRequest('GET'));
            document.getElementById('test-post').addEventListener('click', () => testRequest('POST'));
            document.getElementById('test-with-fingerprint').addEventListener('click', () => testRequestWithFingerprint());
        });

        async function testRequest(method) {
            const resultDiv = document.getElementById('request-result');
            resultDiv.innerHTML = '<div class="text-blue-500">正在发送请求...</div>';

            try {
                const response = await fetch('/debug-request', {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();
                displayResult(data);
            } catch (error) {
                resultDiv.innerHTML = \`<div class="text-red-500">请求失败: \${error.message}</div>\`;
            }
        }

        async function testRequestWithFingerprint() {
            const resultDiv = document.getElementById('request-result');
            resultDiv.innerHTML = '<div class="text-blue-500">正在发送带指纹的请求...</div>';

            try {
                // 收集浏览器指纹
                let fingerprint = null;
                if (window.browserFingerprint) {
                    fingerprint = window.browserFingerprint.getFingerprint();
                }

                const response = await fetch('/debug-request', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // 添加自定义头
                        'X-Screen-Resolution': \`\${screen.width}x\${screen.height}\`,
                        'X-Viewport-Width': window.innerWidth,
                        'X-Viewport-Height': window.innerHeight,
                        'X-Device-Pixel-Ratio': window.devicePixelRatio || 1,
                        'X-Color-Depth': screen.colorDepth,
                        'X-Pixel-Depth': screen.pixelDepth,
                        'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                        'X-Canvas-Fingerprint': fingerprint?.canvasFingerprint || '',
                        'X-WebGL-Fingerprint': fingerprint?.webglFingerprint || '',
                        'X-Fonts': fingerprint?.fonts ? JSON.stringify(fingerprint.fonts) : '',
                        'X-Plugins': fingerprint?.plugins ? JSON.stringify(fingerprint.plugins) : ''
                    },
                    body: JSON.stringify({
                        fingerprint: fingerprint,
                        timestamp: new Date().toISOString(),
                        testData: 'This is a test POST request with fingerprint data'
                    })
                });

                const data = await response.json();
                displayResult(data);
            } catch (error) {
                resultDiv.innerHTML = \`<div class="text-red-500">请求失败: \${error.message}</div>\`;
            }
        }

        function displayResult(data) {
            const resultDiv = document.getElementById('request-result');
            const statsDiv = document.getElementById('stats-info');

            if (data.success) {
                const result = data.data;
                
                // 显示主要信息
                resultDiv.innerHTML = \`
                    <div class="space-y-4">
                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">基本信息</h3>
                            <div class="space-y-1 text-sm">
                                <div><strong>方法:</strong> \${result.requestInfo.method}</div>
                                <div><strong>URL:</strong> \${result.requestInfo.url}</div>
                                <div><strong>时间:</strong> \${result.timestamp}</div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">代理工具检测</h3>
                            <div class="space-y-2 text-sm">
                                <div class="flex items-center space-x-2">
                                    <span><strong>是否代理工具:</strong></span>
                                    <span class="px-2 py-1 rounded text-xs \${result.requestInfo.isProxyTool ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                        \${result.requestInfo.isProxyTool ? '是' : '否'}
                                    </span>
                                </div>
                                <div><strong>代理工具类型:</strong> \${result.requestInfo.proxyToolType}</div>
                                <div><strong>User-Agent:</strong> <span class="break-all">\${result.requestInfo.userAgent || '无'}</span></div>
                                <div><strong>检测到的模式:</strong> \${result.requestInfo.proxyToolFeatures.detectedPatterns?.join(', ') || '无'}</div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">代理工具特征</h3>
                            <div class="grid grid-cols-2 gap-2 text-sm">
                                <div><strong>自定义请求头:</strong> \${result.requestInfo.proxyToolFeatures.hasCustomHeaders ? '是' : '否'}</div>
                                <div><strong>代理相关头:</strong> \${result.requestInfo.proxyToolFeatures.hasProxyHeaders ? '是' : '否'}</div>
                                <div><strong>自定义UA:</strong> \${result.requestInfo.proxyToolFeatures.hasCustomUserAgent ? '是' : '否'}</div>
                                <div><strong>缺少浏览器特征:</strong> \${result.requestInfo.proxyToolFeatures.missingBrowserFeatures ? '是' : '否'}</div>
                                <div><strong>请求头数量:</strong> \${result.requestInfo.proxyToolFeatures.headerCount}</div>
                                <div><strong>请求头过少:</strong> \${result.requestInfo.proxyToolFeatures.isLowHeaderCount ? '是' : '否'}</div>
                                <div><strong>Clash特征:</strong> \${result.requestInfo.proxyToolFeatures.hasClashHeaders ? '是' : '否'}</div>
                                <div><strong>V2Ray特征:</strong> \${result.requestInfo.proxyToolFeatures.hasV2RayHeaders ? '是' : '否'}</div>
                                <div><strong>Quantumult特征:</strong> \${result.requestInfo.proxyToolFeatures.hasQuantumultHeaders ? '是' : '否'}</div>
                                <div><strong>Surge特征:</strong> \${result.requestInfo.proxyToolFeatures.hasSurgeHeaders ? '是' : '否'}</div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">User-Agent</h3>
                            <div class="text-sm break-all">\${result.requestInfo.userAgent || '无'}</div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">现代浏览器特征</h3>
                            <div class="grid grid-cols-2 gap-2 text-sm">
                                <div><strong>Sec-Fetch-Site:</strong> \${result.requestInfo.secFetchSite || '无'}</div>
                                <div><strong>Sec-Fetch-Mode:</strong> \${result.requestInfo.secFetchMode || '无'}</div>
                                <div><strong>Sec-Fetch-Dest:</strong> \${result.requestInfo.secFetchDest || '无'}</div>
                                <div><strong>Sec-Fetch-User:</strong> \${result.requestInfo.secFetchUser || '无'}</div>
                                <div><strong>Sec-Ch-Ua:</strong> \${result.requestInfo.secChUa || '无'}</div>
                                <div><strong>Sec-Ch-Ua-Mobile:</strong> \${result.requestInfo.secChUaMobile || '无'}</div>
                                <div><strong>Sec-Ch-Ua-Platform:</strong> \${result.requestInfo.secChUaPlatform || '无'}</div>
                                <div><strong>Upgrade-Insecure-Requests:</strong> \${result.requestInfo.upgradeInsecureRequests || '无'}</div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">Cloudflare信息</h3>
                            <div class="grid grid-cols-2 gap-2 text-sm">
                                <div><strong>国家:</strong> \${result.cfInfo.country || '无'}</div>
                                <div><strong>城市:</strong> \${result.cfInfo.city || '无'}</div>
                                <div><strong>时区:</strong> \${result.cfInfo.timezone || '无'}</div>
                                <div><strong>ASN:</strong> \${result.cfInfo.asn || '无'}</div>
                                <div><strong>TLS版本:</strong> \${result.cfInfo.tlsVersion || '无'}</div>
                                <div><strong>HTTP协议:</strong> \${result.cfInfo.httpProtocol || '无'}</div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">自定义头信息</h3>
                            <div class="grid grid-cols-2 gap-2 text-sm">
                                <div><strong>X-Screen-Resolution:</strong> \${result.requestInfo.xScreenResolution || '无'}</div>
                                <div><strong>X-Viewport-Width:</strong> \${result.requestInfo.xViewportWidth || '无'}</div>
                                <div><strong>X-Viewport-Height:</strong> \${result.requestInfo.xViewportHeight || '无'}</div>
                                <div><strong>X-Device-Pixel-Ratio:</strong> \${result.requestInfo.xDevicePixelRatio || '无'}</div>
                                <div><strong>X-Timezone:</strong> \${result.requestInfo.xTimezone || '无'}</div>
                                <div><strong>X-Canvas-Fingerprint:</strong> \${result.requestInfo.xCanvasFingerprint ? '有' : '无'}</div>
                            </div>
                        </div>

                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">所有请求头 (\${result.stats.totalHeaders}个)</h3>
                            <div class="max-h-64 overflow-y-auto">
                                \${Object.entries(result.allHeaders).map(([key, value]) => 
                                    \`<div class="flex justify-between text-sm py-1 border-b border-gray-200">
                                        <span class="font-medium">\${key}:</span>
                                        <span class="text-gray-600 break-all max-w-md">\${value}</span>
                                    </div>\`
                                ).join('')}
                            </div>
                        </div>

                        \${result.bodyInfo ? \`
                        <div class="bg-gray-50 p-4 rounded">
                            <h3 class="font-semibold mb-2">请求体信息</h3>
                            <div class="text-sm">
                                <div><strong>类型:</strong> \${result.bodyInfo.type}</div>
                                <div><strong>大小:</strong> \${result.bodyInfo.size} 字节</div>
                                <div><strong>内容:</strong></div>
                                <pre class="bg-gray-100 p-2 rounded mt-2 text-xs overflow-x-auto">\${JSON.stringify(result.bodyInfo.data, null, 2)}</pre>
                            </div>
                        </div>
                        \` : ''}
                    </div>
                \`;

                // 显示统计信息
                statsDiv.innerHTML = \`
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-blue-100 p-3 rounded text-center">
                            <div class="text-2xl font-bold text-blue-600">\${result.stats.totalHeaders}</div>
                            <div class="text-sm text-blue-800">总请求头数</div>
                        </div>
                        <div class="bg-green-100 p-3 rounded text-center">
                            <div class="text-2xl font-bold text-green-600">\${result.stats.nonEmptyHeaders}</div>
                            <div class="text-sm text-green-800">非空请求头</div>
                        </div>
                        <div class="bg-purple-100 p-3 rounded text-center">
                            <div class="text-2xl font-bold text-purple-600">\${result.stats.modernBrowserHeaders}</div>
                            <div class="text-sm text-purple-800">现代浏览器头</div>
                        </div>
                        <div class="bg-orange-100 p-3 rounded text-center">
                            <div class="text-2xl font-bold text-orange-600">\${result.stats.customHeaders}</div>
                            <div class="text-sm text-orange-800">自定义头</div>
                        </div>
                    </div>
                \`;
            } else {
                resultDiv.innerHTML = \`<div class="text-red-500">请求失败: \${data.message}</div>\`;
            }
        }
    </script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    }
  });
}
