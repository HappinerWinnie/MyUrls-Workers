// 真实代理工具访问记录页面
export async function onRequest(context) {
  const { request } = context;
  
  // 返回真实代理工具访问记录页面HTML
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>真实代理工具访问记录</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen">
    <div class="container mx-auto px-4 py-8">
        <div class="max-w-6xl mx-auto">
            <h1 class="text-3xl font-bold text-gray-800 mb-8">真实代理工具访问记录</h1>
            
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
                <h2 class="text-lg font-semibold text-yellow-800 mb-2">使用说明</h2>
                <p class="text-yellow-700 text-sm">
                    请使用真实的代理工具（如Clash、V2Ray、Quantumult等）访问此页面，系统将原封不动地记录所有请求头信息。
                    您可以使用以下URL进行测试：
                </p>
                <div class="mt-2 space-y-1">
                    <div class="text-sm font-mono bg-gray-100 p-2 rounded">
                        <strong>调试接口：</strong> <span id="debug-url" class="text-blue-600"></span>
                    </div>
                    <div class="text-sm font-mono bg-gray-100 p-2 rounded">
                        <strong>短链接测试：</strong> <span id="short-url" class="text-blue-600"></span>
                    </div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-lg p-6 mb-8">
                <h2 class="text-xl font-semibold mb-4">实时访问记录</h2>
                <div class="space-y-4">
                    <button id="refresh-btn" class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        刷新记录
                    </button>
                    <button id="clear-btn" class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 ml-2">
                        清空记录
                    </button>
                </div>
                <div id="access-logs" class="mt-4 space-y-4">
                    <div class="text-gray-500">等待代理工具访问...</div>
                </div>
            </div>

            <div class="bg-white rounded-lg shadow-lg p-6">
                <h2 class="text-xl font-semibold mb-4">访问统计</h2>
                <div id="access-stats" class="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div class="bg-blue-100 p-3 rounded text-center">
                        <div class="text-2xl font-bold text-blue-600" id="total-requests">0</div>
                        <div class="text-sm text-blue-800">总访问次数</div>
                    </div>
                    <div class="bg-green-100 p-3 rounded text-center">
                        <div class="text-2xl font-bold text-green-600" id="proxy-requests">0</div>
                        <div class="text-sm text-green-800">代理工具访问</div>
                    </div>
                    <div class="bg-purple-100 p-3 rounded text-center">
                        <div class="text-2xl font-bold text-purple-600" id="browser-requests">0</div>
                        <div class="text-sm text-purple-800">浏览器访问</div>
                    </div>
                    <div class="bg-orange-100 p-3 rounded text-center">
                        <div class="text-2xl font-bold text-orange-600" id="unknown-requests">0</div>
                        <div class="text-sm text-orange-800">未知类型</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let accessLogs = [];
        let stats = {
            total: 0,
            proxy: 0,
            browser: 0,
            unknown: 0
        };

        document.addEventListener('DOMContentLoaded', function() {
            // 设置URL
            const baseUrl = window.location.origin;
            document.getElementById('debug-url').textContent = baseUrl + '/debug-request';
            document.getElementById('short-url').textContent = baseUrl + '/test123';
            
            // 绑定按钮事件
            document.getElementById('refresh-btn').addEventListener('click', refreshLogs);
            document.getElementById('clear-btn').addEventListener('click', clearLogs);
            
            // 自动刷新
            setInterval(refreshLogs, 5000);
            
            // 初始加载
            refreshLogs();
        });

        async function refreshLogs() {
            try {
                // 获取访问日志
                const response = await fetch('/api/access-logs?action=list&limit=20');
                const data = await response.json();
                
                if (data.success) {
                    // 清空当前日志并重新加载
                    accessLogs = data.data.logs || [];
                    stats = { total: 0, proxy: 0, browser: 0, unknown: 0 };
                    
                    // 重新计算统计
                    accessLogs.forEach(log => {
                        stats.total++;
                        if (log.isProxyTool) {
                            stats.proxy++;
                        } else if (log.userAgent && (
                            log.userAgent.includes('Mozilla') || 
                            log.userAgent.includes('Chrome') || 
                            log.userAgent.includes('Firefox') || 
                            log.userAgent.includes('Safari')
                        )) {
                            stats.browser++;
                        } else {
                            stats.unknown++;
                        }
                    });
                    
                    displayLogs();
                }
            } catch (error) {
                console.error('刷新记录失败:', error);
            }
        }

        function addAccessLog(logData) {
            const log = {
                id: Date.now(),
                timestamp: new Date().toISOString(),
                method: logData.requestInfo.method,
                url: logData.requestInfo.url,
                userAgent: logData.requestInfo.userAgent,
                isProxyTool: logData.requestInfo.isProxyTool,
                proxyToolType: logData.requestInfo.proxyToolType,
                headers: logData.requestInfo.rawHeaders,
                cfInfo: logData.cfInfo,
                stats: logData.stats
            };
            
            accessLogs.unshift(log);
            if (accessLogs.length > 50) {
                accessLogs = accessLogs.slice(0, 50);
            }
            
            updateStats(log);
            displayLogs();
        }

        function updateStats(log) {
            stats.total++;
            if (log.isProxyTool) {
                stats.proxy++;
            } else if (log.userAgent && (
                log.userAgent.includes('Mozilla') || 
                log.userAgent.includes('Chrome') || 
                log.userAgent.includes('Firefox') || 
                log.userAgent.includes('Safari')
            )) {
                stats.browser++;
            } else {
                stats.unknown++;
            }
        }

        function displayLogs() {
            const logsDiv = document.getElementById('access-logs');
            
            if (accessLogs.length === 0) {
                logsDiv.innerHTML = '<div class="text-gray-500">暂无访问记录</div>';
                return;
            }
            
            logsDiv.innerHTML = accessLogs.map(log => \`
                <div class="border border-gray-200 rounded-lg p-4 \${log.isProxyTool ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex items-center space-x-2">
                            <span class="px-2 py-1 rounded text-xs \${log.isProxyTool ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}">
                                \${log.isProxyTool ? '代理工具' : '浏览器'}
                            </span>
                            <span class="text-sm font-medium">\${log.proxyToolType || '浏览器'}</span>
                        </div>
                        <div class="text-sm text-gray-500">\${new Date(log.timestamp).toLocaleString('zh-CN')}</div>
                    </div>
                    
                    <div class="space-y-2 text-sm">
                        <div><strong>User-Agent:</strong> <span class="break-all font-mono">\${log.userAgent || '无'}</span></div>
                        <div><strong>请求头数量:</strong> \${log.stats?.totalHeaders || 0}</div>
                        <div><strong>地理位置:</strong> \${log.cfInfo?.country || '未知'} - \${log.cfInfo?.city || '未知'}</div>
                        
                        <details class="mt-2">
                            <summary class="cursor-pointer text-blue-600 hover:text-blue-800">查看完整请求头</summary>
                            <div class="mt-2 bg-gray-100 p-3 rounded max-h-64 overflow-y-auto">
                                <pre class="text-xs">\${JSON.stringify(log.headers, null, 2)}</pre>
                            </div>
                        </details>
                    </div>
                </div>
            \`).join('');
            
            // 更新统计
            document.getElementById('total-requests').textContent = stats.total;
            document.getElementById('proxy-requests').textContent = stats.proxy;
            document.getElementById('browser-requests').textContent = stats.browser;
            document.getElementById('unknown-requests').textContent = stats.unknown;
        }

        async function clearLogs() {
            try {
                const response = await fetch('/api/access-logs?action=clear', {
                    method: 'POST'
                });
                const data = await response.json();
                
                if (data.success) {
                    accessLogs = [];
                    stats = { total: 0, proxy: 0, browser: 0, unknown: 0 };
                    displayLogs();
                    alert(\`已清空 \${data.data.deletedCount} 条访问记录\`);
                } else {
                    alert('清空记录失败: ' + data.message);
                }
            } catch (error) {
                console.error('清空记录失败:', error);
                alert('清空记录失败: ' + error.message);
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
