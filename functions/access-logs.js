// 访问记录页面
import { htmlResponse } from './utils/response.js';

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const shortKey = url.searchParams.get('shortKey');

  const htmlContent = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>访问记录 - MyUrls</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
    <style>
        .fade-in {
            animation: fadeIn 0.3s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .status-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 0.375rem;
            font-size: 0.75rem;
            font-weight: 500;
        }
        .status-proxy {
            background-color: #fef3c7;
            color: #92400e;
        }
        .status-browser {
            background-color: #d1fae5;
            color: #065f46;
        }
        .status-unknown {
            background-color: #f3f4f6;
            color: #374151;
        }
    </style>
</head>
<body class="bg-gray-50">
    <div id="app">
        <!-- 导航栏 -->
        <nav class="bg-white shadow-sm border-b">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <h1 class="text-xl font-semibold text-gray-900">访问记录</h1>
                        <span v-if="shortKey" class="ml-4 px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full">
                            {{ shortKey }}
                        </span>
                    </div>
                    <div class="flex items-center space-x-4">
                        <button @click="refreshData" class="text-sm text-blue-600 hover:text-blue-800">
                            刷新
                        </button>
                        <button @click="goBack" class="text-sm text-gray-600 hover:text-gray-800">
                            返回管理后台
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- 主要内容 -->
        <div class="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
            <!-- 统计卡片 -->
            <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">总</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">总访问量</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.total }}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-yellow-500 rounded-md flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">代</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">代理工具</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.proxy }}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">浏</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">浏览器</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.browser }}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-gray-500 rounded-md flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">未</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">未知类型</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.unknown }}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 访问记录列表 -->
            <div class="bg-white shadow rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">访问记录</h3>
                        <div class="flex space-x-2">
                            <button @click="clearLogs" class="px-3 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50">
                                清空记录
                            </button>
                        </div>
                    </div>

                    <div v-if="loading" class="text-center py-8">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p class="mt-2 text-gray-500">加载中...</p>
                    </div>

                    <div v-else-if="logs.length === 0" class="text-center py-8 text-gray-500">
                        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p class="mt-2">暂无访问记录</p>
                    </div>

                    <!-- 有数据时的显示 -->
                    <div v-else>
                        <!-- 桌面端表格 -->
                        <div class="hidden md:block overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">IP地址</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User-Agent</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">类型</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">国家/地区</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">设备指纹</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="log in logs" :key="log.id" class="fade-in">
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ formatDate(log.visit_timestamp) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ log.ip_address }}
                                    </td>
                                    <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" :title="log.user_agent">
                                        {{ log.user_agent }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="getStatusClass(log)" class="status-badge">
                                            {{ getStatusText(log) }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {{ log.country || '未知' }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {{ log.device_id ? log.device_id.substring(0, 16) + '...' : '未知' }}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                        <!-- 移动端卡片布局 -->
                        <div class="md:hidden space-y-4">
                        <div v-for="log in logs" :key="log.id" class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm fade-in">
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium text-gray-900">
                                        {{ formatDate(log.visit_timestamp) }}
                                    </div>
                                    <div class="text-sm text-gray-500">
                                        {{ log.ip_address }}
                                    </div>
                                </div>
                                <span :class="getStatusClass(log)" class="status-badge ml-2">
                                    {{ getStatusText(log) }}
                                </span>
                            </div>

                            <div class="text-sm text-gray-900 mb-2" :title="log.user_agent">
                                <span class="font-medium">UA:</span> {{ log.user_agent }}
                            </div>

                            <div class="flex justify-between items-center text-sm text-gray-500">
                                <div>
                                    <span class="font-medium">地区:</span> {{ log.country || '未知' }}
                                </div>
                                <div>
                                    <span class="font-medium">设备:</span> {{ log.device_id ? log.device_id.substring(0, 8) + '...' : '未知' }}
                                </div>
                            </div>
                        </div>
                        </div>
                    </div>

                    <!-- 分页控件 -->
                    <div v-if="pagination.totalPages > 1" class="mt-6 flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-700">每页显示:</span>
                            <select v-model="pagination.limit" @change="changePageSize"
                                    class="border-gray-300 rounded-md text-sm">
                                <option value="20">20</option>
                                <option value="50">50</option>
                                <option value="100">100</option>
                            </select>
                        </div>

                        <div class="flex items-center space-x-2">
                            <button @click="goToPage(pagination.page - 1)"
                                    :disabled="pagination.page <= 1"
                                    class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50">
                                上一页
                            </button>

                            <span class="text-sm text-gray-700">
                                第 {{ pagination.page }} 页，共 {{ pagination.totalPages }} 页
                            </span>

                            <button @click="goToPage(pagination.page + 1)"
                                    :disabled="pagination.page >= pagination.totalPages"
                                    class="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50">
                                下一页
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        const { createApp } = Vue;
        
        createApp({
            data() {
                return {
                    logs: [],
                    stats: {
                        total: 0,
                        proxy: 0,
                        browser: 0,
                        unknown: 0
                    },
                    loading: false,
                    shortKey: '${shortKey || ""}',
                    pagination: {
                        page: 1,
                        limit: 50,
                        total: 0,
                        totalPages: 0
                    }
                }
            },
            mounted() {
                console.log('Vue app mounted, shortKey:', this.shortKey);
                this.loadData();
            },
            methods: {
                async loadData() {
                    this.loading = true;
                    try {
                        await Promise.all([
                            this.loadLogs(),
                            this.loadStats()
                        ]);
                    } catch (error) {
                        console.error('Failed to load data:', error);
                        alert('加载数据失败，请重试');
                    } finally {
                        this.loading = false;
                    }
                },

                async loadLogs() {
                    const params = new URLSearchParams({
                        limit: this.pagination.limit.toString(),
                        offset: ((this.pagination.page - 1) * this.pagination.limit).toString()
                    });
                    
                    if (this.shortKey) {
                        params.append('shortKey', this.shortKey);
                    }

                    try {
                        const response = await axios.get('/api/access-logs?' + params);
                        console.log('API Response:', response.data);
                        
                        if (response.data.success) {
                            this.logs = response.data.data.logs || [];
                            this.pagination.total = response.data.data.total || 0;
                            this.pagination.totalPages = Math.ceil(this.pagination.total / this.pagination.limit);
                            console.log('Loaded logs:', this.logs.length, 'Total:', this.pagination.total);
                        } else {
                            console.error('API returned error:', response.data.error);
                            alert('加载数据失败: ' + (response.data.error?.message || '未知错误'));
                        }
                    } catch (error) {
                        console.error('Failed to load logs:', error);
                        alert('加载数据失败: ' + error.message);
                    }
                },

                async loadStats() {
                    const params = new URLSearchParams();
                    if (this.shortKey) {
                        params.append('shortKey', this.shortKey);
                    }

                    try {
                        const response = await axios.get('/api/access-logs?action=stats&' + params);
                        console.log('Stats API Response:', response.data);
                        
                        if (response.data.success) {
                            this.stats = response.data.data || {
                                total: 0,
                                proxy: 0,
                                browser: 0,
                                unknown: 0
                            };
                            console.log('Loaded stats:', this.stats);
                        } else {
                            console.error('Stats API returned error:', response.data.error);
                        }
                    } catch (error) {
                        console.error('Failed to load stats:', error);
                    }
                },

                async refreshData() {
                    await this.loadData();
                },

                async clearLogs() {
                    if (!confirm('确定要清空访问记录吗？此操作不可恢复！')) return;
                    
                    try {
                        const params = new URLSearchParams();
                        if (this.shortKey) {
                            params.append('shortKey', this.shortKey);
                        }

                        const response = await axios.post('/api/access-logs?action=clear&' + params);
                        if (response.data.success) {
                            alert('访问记录已清空');
                            await this.loadData();
                        } else {
                            alert('清空失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('清空失败，请重试');
                    }
                },

                goToPage(page) {
                    if (page >= 1 && page <= this.pagination.totalPages) {
                        this.pagination.page = page;
                        this.loadLogs();
                    }
                },

                changePageSize() {
                    this.pagination.page = 1;
                    this.loadLogs();
                },

                goBack() {
                    window.close();
                },

                formatDate(dateString) {
                    if (!dateString) return 'Invalid Date';
                    try {
                        const date = new Date(dateString);
                        if (isNaN(date.getTime())) return 'Invalid Date';
                        return date.toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                    } catch (error) {
                        return 'Invalid Date';
                    }
                },

                getStatusClass(log) {
                    if (log.is_proxy_tool === 1) return 'status-proxy';
                    if (log.is_proxy_tool === 0) return 'status-browser';
                    return 'status-unknown';
                },

                getStatusText(log) {
                    if (log.is_proxy_tool === 1) return '代理工具';
                    if (log.is_proxy_tool === 0) return '浏览器';
                    return '未知';
                }
            }
        }).mount('#app');
    </script>
</body>
</html>
  `;

  return htmlResponse(htmlContent.replace(/\$\{shortKey \|\| ""\}/g, shortKey || ''));
}