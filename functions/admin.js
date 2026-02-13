// 管理后台页面
import { htmlResponse, redirectResponse } from './utils/response.js';
import { authMiddleware } from './utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return htmlResponse("Service not configured", 500);
  }

  // 检查认证
  const auth = await authMiddleware(request, env, db);
  
  if (!auth || !auth.isAuthenticated) {
    // 显示登录页面
    return htmlResponse(getLoginPage());
  }

  // 显示管理后台
  return htmlResponse(getAdminPage());
}

/**
 * 生成登录页面
 */
function getLoginPage() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台登录 - MyUrls</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-800">MyUrls</h1>
            <p class="text-gray-600 mt-2">管理后台登录</p>
        </div>
        
        <form id="loginForm" class="space-y-6">
            <div>
                <label for="password" class="block text-sm font-medium text-gray-700">管理员密码</label>
                <input type="password" id="password" name="password" required
                       class="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500">
            </div>
            
            <div id="error" class="text-red-600 text-sm hidden"></div>
            
            <button type="submit" id="loginBtn"
                    class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                <span id="loginText">登录</span>
                <span id="loginSpinner" class="hidden ml-2">
                    <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                </span>
            </button>
        </form>
    </div>

    <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const password = document.getElementById('password').value;
            const errorDiv = document.getElementById('error');
            const loginBtn = document.getElementById('loginBtn');
            const loginText = document.getElementById('loginText');
            const loginSpinner = document.getElementById('loginSpinner');
            
            // 显示加载状态
            loginBtn.disabled = true;
            loginText.textContent = '登录中...';
            loginSpinner.classList.remove('hidden');
            errorDiv.classList.add('hidden');
            
            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ password })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // 登录成功，重定向到管理页面
                    window.location.reload();
                } else {
                    // 显示错误信息
                    errorDiv.textContent = data.error.message;
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                errorDiv.textContent = '登录失败，请重试';
                errorDiv.classList.remove('hidden');
            } finally {
                // 恢复按钮状态
                loginBtn.disabled = false;
                loginText.textContent = '登录';
                loginSpinner.classList.add('hidden');
            }
        });
    </script>
</body>
</html>`;
}

/**
 * 生成管理后台页面
 */
function getAdminPage() {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>管理后台 - MyUrls</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/vue@3/dist/vue.global.js"></script>
    <script src="https://unpkg.com/axios/dist/axios.min.js"></script>
    <style>
        /* 移动端优化 */
        @media (max-width: 768px) {
            .overflow-x-auto table {
                font-size: 0.875rem;
            }

            .px-6 {
                padding-left: 0.75rem;
                padding-right: 0.75rem;
            }

            .py-4 {
                padding-top: 0.5rem;
                padding-bottom: 0.5rem;
            }

            .grid-cols-1.md\\:grid-cols-4 {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }

            .grid-cols-1.md\\:grid-cols-2 {
                grid-template-columns: 1fr;
            }

            .max-w-7xl {
                max-width: 100%;
                padding-left: 1rem;
                padding-right: 1rem;
            }
        }

        @media (max-width: 480px) {
            .grid-cols-1.md\\:grid-cols-4 {
                grid-template-columns: 1fr;
            }

            .text-lg {
                font-size: 1rem;
            }

            .text-xl {
                font-size: 1.125rem;
            }

            .px-4 {
                padding-left: 0.5rem;
                padding-right: 0.5rem;
            }

            .py-5 {
                padding-top: 1rem;
                padding-bottom: 1rem;
            }

            .sm\\:p-6 {
                padding: 1rem;
            }
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
                        <h1 class="text-xl font-semibold text-gray-900">MyUrls 管理后台</h1>
                    </div>
                    <div class="flex items-center space-x-4">
                        <span class="text-sm text-gray-500">欢迎，管理员</span>
                        <button @click="logout" class="text-sm text-red-600 hover:text-red-800">退出登录</button>
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
                                    <span class="text-white text-sm font-medium">链</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">总链接数</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.totalLinks }}</dd>
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
                                    <span class="text-white text-sm font-medium">访</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">总访问量</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.totalVisits }}</dd>
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
                                    <span class="text-white text-sm font-medium">今</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">今日访问</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.todayVisits }}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="bg-white overflow-hidden shadow rounded-lg">
                    <div class="p-5">
                        <div class="flex items-center">
                            <div class="flex-shrink-0">
                                <div class="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                                    <span class="text-white text-sm font-medium">活</span>
                                </div>
                            </div>
                            <div class="ml-5 w-0 flex-1">
                                <dl>
                                    <dt class="text-sm font-medium text-gray-500 truncate">活跃链接</dt>
                                    <dd class="text-lg font-medium text-gray-900">{{ stats.activeLinks }}</dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 创建链接表单 -->
            <div class="bg-white shadow rounded-lg mb-8">
                <div class="px-4 py-5 sm:p-6">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">创建新的短链接</h3>
                    <form @submit.prevent="createLink" class="space-y-4">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">长链接 *</label>
                                <input v-model="newLink.longUrl" type="url" required
                                       class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">自定义别名</label>
                                <input v-model="newLink.shortKey" type="text"
                                       class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-sm font-medium text-gray-700">标题</label>
                                <input v-model="newLink.title" type="text"
                                       class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700">访问次数限制</label>
                                <input v-model="newLink.maxVisits" type="number" min="-1" placeholder="-1表示无限制"
                                       class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            </div>
                        </div>

                        <div>
                            <label class="block text-sm font-medium text-gray-700">描述</label>
                            <textarea v-model="newLink.description" rows="2"
                                      class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"></textarea>
                        </div>

                        <div class="flex justify-end">
                            <button type="submit" :disabled="creating"
                                    class="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50">
                                <span v-if="!creating">创建链接</span>
                                <span v-else>创建中...</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- 链接列表 -->
            <div class="bg-white shadow rounded-lg">
                <div class="px-4 py-5 sm:p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg leading-6 font-medium text-gray-900">链接管理</h3>
                        <div class="flex space-x-2">
                            <input v-model="searchQuery" @input="searchLinks" type="text" placeholder="搜索链接..."
                                   class="border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
                            <button @click="loadLinks" class="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                刷新
                            </button>
                            <div class="relative">
                                <button @click="showExportMenu = !showExportMenu" :disabled="exporting"
                                        class="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center">
                                    <svg v-if="exporting" class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                        <path class="opacity-75" fill="currentColor" d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    {{ exporting ? '导出中...' : '导出数据' }}
                                    <svg class="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
                                    </svg>
                                </button>
                                <div v-if="showExportMenu" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                    <div class="py-1">
                                        <button @click="exportLinks('csv')" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            导出为 CSV
                                        </button>
                                        <button @click="exportLinks('json')" class="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                                            导出为 JSON
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <button @click="showRiskControl = !showRiskControl" class="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                {{ showRiskControl ? '隐藏风控' : '风控管理' }}
                            </button>
                            <button @click="clearCache" class="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                                清除缓存
                            </button>
                        </div>
                    </div>

                    <!-- 性能信息 -->
                    <div v-if="meta.cacheUsed !== undefined" class="mb-4 p-3 bg-gray-50 rounded-lg">
                        <div class="flex items-center justify-between text-sm text-gray-600">
                            <span>缓存状态: {{ meta.cacheUsed ? '已使用' : '未使用' }}</span>
                            <span>系统总链接数: {{ meta.totalLinksInSystem }}</span>
                            <span>当前页显示: {{ links.length }} / {{ pagination.total }}</span>
                        </div>
                    </div>

                    <!-- 分页控件 -->
                    <div v-if="pagination.totalPages > 1" class="mb-4 flex items-center justify-between">
                        <div class="flex items-center space-x-2">
                            <span class="text-sm text-gray-700">每页显示:</span>
                            <select v-model="pagination.limit" @change="changePageSize(pagination.limit)"
                                    class="border-gray-300 rounded-md text-sm">
                                <option value="10">10</option>
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

                    <div v-if="loading" class="text-center py-4">
                        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>

                    <div v-else-if="links.length === 0" class="text-center py-8 text-gray-500">
                        暂无链接数据
                    </div>

                    <!-- 桌面端表格 -->
                    <div class="hidden md:block overflow-x-auto">
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50">
                                <tr>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">短链接</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">目标链接</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">访问统计</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建时间</th>
                                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                                </tr>
                            </thead>
                            <tbody class="bg-white divide-y divide-gray-200">
                                <tr v-for="link in links" :key="link.id">
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <div class="text-sm font-medium text-blue-600">
                                            <a :href="'/' + link.short_key" target="_blank">{{ link.short_key }}</a>
                                        </div>
                                        <div v-if="link.title" class="text-sm text-gray-500">{{ link.title }}</div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-sm text-gray-900 max-w-xs truncate" :title="link.long_url">
                                            {{ link.long_url }}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div>{{ link.visit_count || 0 }}{{ link.max_visits > 0 ? '/' + link.max_visits : '' }}</div>
                                        <div class="text-xs text-gray-500">{{ formatVisitStats(link) }}</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="getStatusClass(link)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                            {{ getStatusText(link) }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {{ formatDate(link.created_at) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                        <button @click="viewAccessLogs(link)" class="text-purple-600 hover:text-purple-900 mr-3">访问记录</button>
                                        <button @click="editLink(link)" class="text-green-600 hover:text-green-900 mr-3">编辑</button>
                                        <button @click="copyLink(link)" class="text-blue-600 hover:text-blue-900 mr-3">复制</button>
                                        <button @click="deleteLink(link)" class="text-red-600 hover:text-red-900">删除</button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <!-- 移动端卡片布局 -->
                    <div class="md:hidden space-y-4">
                        <div v-for="link in links" :key="link.id" class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                            <div class="flex justify-between items-start mb-3">
                                <div class="flex-1 min-w-0">
                                    <div class="text-sm font-medium text-blue-600 truncate">
                                        <a :href="'/' + link.short_key" target="_blank">{{ link.short_key }}</a>
                                    </div>
                                    <div v-if="link.title" class="text-sm text-gray-500 truncate">{{ link.title }}</div>
                                </div>
                                <span :class="getStatusClass(link)" class="px-2 py-1 text-xs font-semibold rounded-full ml-2">
                                    {{ getStatusText(link) }}
                                </span>
                            </div>

                            <div class="text-sm text-gray-900 mb-2 truncate" :title="link.long_url">
                                <span class="font-medium">目标:</span> {{ link.long_url }}
                            </div>

                            <div class="flex justify-between items-center text-sm text-gray-500 mb-3">
                                <div>
                                    <span class="font-medium">访问:</span>
                                    {{ link.visit_count || 0 }}{{ link.max_visits > 0 ? '/' + link.max_visits : '' }}
                                    ({{ formatVisitStats(link) }})
                                </div>
                                <div>{{ formatDate(link.created_at) }}</div>
                            </div>

                            <div class="flex space-x-3">
                                <button @click="viewAccessLogs(link)" class="text-purple-600 hover:text-purple-900 text-sm font-medium">
                                    访问记录
                                </button>
                                <button @click="editLink(link)" class="text-green-600 hover:text-green-900 text-sm font-medium">
                                    编辑
                                </button>
                                <button @click="copyLink(link)" class="text-blue-600 hover:text-blue-900 text-sm font-medium">
                                    复制链接
                                </button>
                                <button @click="deleteLink(link)" class="text-red-600 hover:text-red-900 text-sm font-medium">
                                    删除
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 风控管理面板 -->
            <div v-if="showRiskControl" class="bg-white shadow rounded-lg mt-8">
                <div class="px-4 py-5 sm:p-6">
                    <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">风控管理</h3>
                    
                    <!-- 封禁管理 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <!-- 封禁设备 -->
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h4 class="text-md font-medium text-gray-900 mb-3">封禁设备</h4>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">设备ID</label>
                                    <input v-model="blockDeviceForm.deviceId" type="text" placeholder="设备指纹ID"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">封禁原因</label>
                                    <input v-model="blockDeviceForm.reason" type="text" placeholder="封禁原因"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">封禁时长（秒，留空永久）</label>
                                    <input v-model="blockDeviceForm.duration" type="number" placeholder="3600"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <button @click="blockDevice" :disabled="blockingDevice"
                                        class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                                    {{ blockingDevice ? '封禁中...' : '封禁设备' }}
                                </button>
                            </div>
                        </div>

                        <!-- 封禁IP -->
                        <div class="border border-gray-200 rounded-lg p-4">
                            <h4 class="text-md font-medium text-gray-900 mb-3">封禁IP</h4>
                            <div class="space-y-3">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">IP地址</label>
                                    <input v-model="blockIPForm.ipAddress" type="text" placeholder="192.168.1.1"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">封禁原因</label>
                                    <input v-model="blockIPForm.reason" type="text" placeholder="封禁原因"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">封禁时长（秒，留空永久）</label>
                                    <input v-model="blockIPForm.duration" type="number" placeholder="3600"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>
                                <button @click="blockIP" :disabled="blockingIP"
                                        class="w-full px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50">
                                    {{ blockingIP ? '封禁中...' : '封禁IP' }}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- 封禁列表 -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- 被封禁的设备 -->
                        <div>
                            <h4 class="text-md font-medium text-gray-900 mb-3">被封禁的设备</h4>
                            <div v-if="blockedDevices.length === 0" class="text-gray-500 text-sm">暂无被封禁的设备</div>
                            <div v-else class="space-y-2">
                                <div v-for="device in blockedDevices" :key="device.deviceId" 
                                     class="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-md">
                                    <div>
                                        <div class="text-sm font-medium text-gray-900">{{ device.deviceId.substring(0, 16) }}...</div>
                                        <div class="text-xs text-gray-500">{{ device.reason }}</div>
                                        <div class="text-xs text-gray-500">{{ formatDate(device.blockedAt) }}</div>
                                    </div>
                                    <button @click="unblockDevice(device.deviceId)" 
                                            class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                        解封
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- 被封禁的IP -->
                        <div>
                            <h4 class="text-md font-medium text-gray-900 mb-3">被封禁的IP</h4>
                            <div v-if="blockedIPs.length === 0" class="text-gray-500 text-sm">暂无被封禁的IP</div>
                            <div v-else class="space-y-2">
                                <div v-for="ip in blockedIPs" :key="ip.ipAddress" 
                                     class="flex justify-between items-center p-3 bg-red-50 border border-red-200 rounded-md">
                                    <div>
                                        <div class="text-sm font-medium text-gray-900">{{ ip.ipAddress }}</div>
                                        <div class="text-xs text-gray-500">{{ ip.reason }}</div>
                                        <div class="text-xs text-gray-500">{{ formatDate(ip.blockedAt) }}</div>
                                    </div>
                                    <button @click="unblockIP(ip.ipAddress)" 
                                            class="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                                        解封
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 编辑链接模态框 -->
        <div v-if="showEditModal" class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div class="relative top-10 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-2/3 xl:w-1/2 shadow-lg rounded-md bg-white max-h-screen overflow-y-auto">
                <div class="mt-3">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-lg font-medium text-gray-900">编辑链接 - 完整字段修改</h3>
                        <button @click="closeEditModal" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>

                    <form @submit.prevent="updateLink" class="space-y-6">
                        <!-- 基础信息 -->
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h4 class="text-md font-medium text-gray-900 mb-3">基础信息</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">短链接别名</label>
                                    <input type="text" v-model="editingLink.shortKey"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">修改后原链接将失效</p>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">目标URL</label>
                                    <input type="url" v-model="editingLink.longUrl"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">可以修改目标链接</p>
                                </div>
                            </div>
                        </div>

                        <!-- 内容信息 -->
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h4 class="text-md font-medium text-gray-900 mb-3">内容信息</h4>
                            <div class="space-y-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">标题</label>
                                    <input type="text" v-model="editingLink.title"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">描述</label>
                                    <textarea v-model="editingLink.description" rows="3"
                                              class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">标签</label>
                                    <input type="text" v-model="editingLink.tagsString" placeholder="用逗号分隔多个标签"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">例如: 工具,网站,推荐</p>
                                </div>
                            </div>
                        </div>

                        <!-- 访问控制 -->
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h4 class="text-md font-medium text-gray-900 mb-3">访问控制</h4>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">访问次数限制</label>
                                    <input type="number" v-model="editingLink.maxVisits" min="-1"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">-1表示无限制</p>
                                    <div v-if="editingLink.maxVisits !== originalMaxVisits" class="mt-2 p-2 bg-blue-50 rounded-md">
                                        <p class="text-sm text-blue-700">
                                            <span v-if="editingLink.maxVisits > originalMaxVisits">
                                                将增加 {{ editingLink.maxVisits - originalMaxVisits }} 次访问机会
                                            </span>
                                            <span v-else-if="editingLink.maxVisits < originalMaxVisits && editingLink.maxVisits >= editingLink.currentVisits">
                                                将减少 {{ originalMaxVisits - editingLink.maxVisits }} 次访问机会
                                            </span>
                                            <span v-else-if="editingLink.maxVisits < editingLink.currentVisits && editingLink.maxVisits > 0">
                                                ⚠️ 新限制小于当前访问次数，链接将立即失效
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">当前访问次数</label>
                                    <input type="number" v-model="editingLink.currentVisits" min="0"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">可以重置访问计数</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">有效期（天）</label>
                                    <input type="number" v-model="editingLink.expiryDays" min="0" placeholder="留空表示永不过期"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">从现在开始计算</p>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">访问密码</label>
                                    <input type="password" v-model="editingLink.password" placeholder="留空表示无密码"
                                           class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                    <p class="text-xs text-gray-500 mt-1">设置后访问需要密码</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">访问模式</label>
                                    <select v-model="editingLink.accessMode"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                        <option value="redirect">直接跳转</option>
                                        <option value="proxy">代理访问</option>
                                        <option value="iframe">嵌入模式</option>
                                    </select>
                                </div>

                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">链接状态</label>
                                    <select v-model="editingLink.isActive"
                                            class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500">
                                        <option :value="true">激活</option>
                                        <option :value="false">禁用</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <!-- 自定义响应头 -->
                        <div class="bg-gray-50 p-4 rounded-lg">
                            <h4 class="text-md font-medium text-gray-900 mb-3">自定义响应头设置</h4>

                            <!-- Subscription-Userinfo 设置 -->
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">订阅用户信息 (subscription-userinfo)</label>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">上传 (GB)</label>
                                        <input v-model="editingLink.subscriptionInfo.upload" type="number" min="0" step="0.01" placeholder="0"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">下载 (GB)</label>
                                        <input v-model="editingLink.subscriptionInfo.download" type="number" min="0" step="0.01" placeholder="0"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">总流量 (GB)</label>
                                        <input v-model="editingLink.subscriptionInfo.total" type="number" min="0" step="0.01" placeholder="400"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">到期时间</label>
                                        <input v-model="editingLink.subscriptionInfo.expire" type="date"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500">用于Clash订阅链接显示流量使用情况</p>
                            </div>

                            <!-- Content-Disposition 设置 -->
                            <div class="mb-4">
                                <label class="block text-sm font-medium text-gray-700 mb-2">文件下载设置 (content-disposition)</label>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">处理方式</label>
                                        <select v-model="editingLink.contentDisposition.type"
                                                class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                            <option value="">不设置</option>
                                            <option value="attachment">下载文件 (attachment)</option>
                                            <option value="inline">内联显示 (inline)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">文件名</label>
                                        <input v-model="editingLink.contentDisposition.filename" type="text" placeholder="config.yaml"
                                               :disabled="!editingLink.contentDisposition.type"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50">
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500 mt-1">设置文件下载行为和文件名</p>
                            </div>

                        <!-- 风控配置 -->
                        <div class="border-t pt-4">
                            <h4 class="text-md font-medium text-gray-900 mb-4">风控配置</h4>
                            
                            <!-- 访问次数限制 -->
                            <div class="mb-6">
                                <h5 class="text-sm font-medium text-gray-700 mb-3">访问次数限制</h5>
                                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">总次数 (-1=无限制)</label>
                                        <input v-model.number="editingLink.riskControl.visitLimits.total" type="number" min="-1"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">同设备 (-1=无限制)</label>
                                        <input v-model.number="editingLink.riskControl.visitLimits.device" type="number" min="-1"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">同IP (-1=无限制)</label>
                                        <input v-model.number="editingLink.riskControl.visitLimits.ip" type="number" min="-1"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">同设备+IP (-1=无限制)</label>
                                        <input v-model.number="editingLink.riskControl.visitLimits.deviceIp" type="number" min="-1"
                                               class="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                                    </div>
                                </div>
                                <p class="text-xs text-gray-500 mt-2">设置访问次数限制，防止恶意访问。同IP限制是您图片中标记的功能。</p>
                            </div>

                            <!-- User-Agent过滤 -->
                            <div class="mb-6">
                                <div class="flex items-center mb-3">
                                    <input type="checkbox" v-model="editingLink.riskControl.uaFilter.enabled" 
                                           class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                    <label class="text-sm font-medium text-gray-700">启用User-Agent过滤</label>
                                </div>
                                <div v-if="editingLink.riskControl.uaFilter.enabled" class="space-y-3">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">黑名单（每行一个）</label>
                                        <textarea v-model="uaBlacklistText" 
                                                  rows="3" placeholder="bot&#10;crawler&#10;spider"
                                                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">白名单（每行一个）</label>
                                        <textarea v-model="uaWhitelistText" 
                                                  rows="3" placeholder="Chrome&#10;Firefox&#10;Safari"
                                                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
                                    </div>
                                </div>
                            </div>

                            <!-- 国家地区限制 -->
                            <div class="mb-6">
                                <div class="flex items-center mb-3">
                                    <input type="checkbox" v-model="editingLink.riskControl.countryRestriction.enabled" 
                                           class="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded">
                                    <label class="text-sm font-medium text-gray-700">启用国家地区限制</label>
                                </div>
                                <div v-if="editingLink.riskControl.countryRestriction.enabled" class="space-y-3">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">允许的国家（每行一个国家代码）</label>
                                        <textarea v-model="countryAllowedText" 
                                                  rows="3" placeholder="CN&#10;US&#10;JP"
                                                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">禁止的国家（每行一个国家代码）</label>
                                        <textarea v-model="countryBlockedText" 
                                                  rows="3" placeholder="RU&#10;KP&#10;IR"
                                                  class="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"></textarea>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- 其他自定义响应头 -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">其他自定义响应头 (JSON格式)</label>
                                <textarea v-model="editingLink.customHeadersJson" rows="3" placeholder='{"header-name": "header-value"}'
                                          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"></textarea>
                                <p class="text-xs text-gray-500 mt-1">JSON格式的自定义响应头，会与上面的设置合并</p>
                            </div>
                        </div>

                        <div class="flex justify-end space-x-3 pt-4">
                            <button type="button" @click="closeEditModal"
                                    class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50">
                                取消
                            </button>
                            <button type="submit" :disabled="updating"
                                    class="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                                <span v-if="updating">更新中...</span>
                                <span v-else>保存更改</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <script>
        const { createApp } = Vue;
        
        createApp({
            data() {
                return {
                    stats: {
                        totalLinks: 0,
                        totalVisits: 0,
                        todayVisits: 0,
                        activeLinks: 0
                    },
                    links: [],
                    loading: false,
                    creating: false,
                    updating: false,
                    searchQuery: '',
                    showEditModal: false,
                    editingLink: {},
                    originalMaxVisits: 0,
                    originalShortKey: '',
                    newLink: {
                        longUrl: '',
                        shortKey: '',
                        title: '',
                        description: '',
                        maxVisits: -1
                    },
                    pagination: {
                        page: 1,
                        limit: 20,
                        total: 0,
                        totalPages: 0
                    },
                    meta: {
                        cacheUsed: false,
                        totalLinksInSystem: 0
                    },
                    searchTimeout: null,
                    showRiskControl: false,
                    blockedDevices: [],
                    blockedIPs: [],
                    blockDeviceForm: {
                        deviceId: '',
                        reason: '',
                        duration: ''
                    },
                    blockIPForm: {
                        ipAddress: '',
                        reason: '',
                        duration: ''
                    },
                    blockingDevice: false,
                    blockingIP: false,
                    showExportMenu: false,
                    exporting: false
                }
            },
            computed: {
                // 风控配置计算属性
                uaBlacklistText: {
                    get() {
                        return this.editingLink.riskControl?.uaFilter?.blacklist?.join('\n') || '';
                    },
                    set(value) {
                        if (this.editingLink.riskControl?.uaFilter) {
                            this.editingLink.riskControl.uaFilter.blacklist = value.split('\n').filter(s => s.trim());
                        }
                    }
                },
                uaWhitelistText: {
                    get() {
                        return this.editingLink.riskControl?.uaFilter?.whitelist?.join('\n') || '';
                    },
                    set(value) {
                        if (this.editingLink.riskControl?.uaFilter) {
                            this.editingLink.riskControl.uaFilter.whitelist = value.split('\n').filter(s => s.trim());
                        }
                    }
                },
                countryAllowedText: {
                    get() {
                        return this.editingLink.riskControl?.countryRestriction?.allowed?.join('\n') || '';
                    },
                    set(value) {
                        if (this.editingLink.riskControl?.countryRestriction) {
                            this.editingLink.riskControl.countryRestriction.allowed = value.split('\n').filter(s => s.trim());
                        }
                    }
                },
                countryBlockedText: {
                    get() {
                        return this.editingLink.riskControl?.countryRestriction?.blocked?.join('\n') || '';
                    },
                    set(value) {
                        if (this.editingLink.riskControl?.countryRestriction) {
                            this.editingLink.riskControl.countryRestriction.blocked = value.split('\n').filter(s => s.trim());
                        }
                    }
                }
            },
            errorCaptured(err, vm, info) {
                console.error('Vue error captured:', err);
                console.error('Error stack:', err.stack);
                console.error('Component:', vm);
                console.error('Error info:', info);
                return false; // 阻止错误继续传播
            },
            mounted() {
                this.loadLinks();
                this.loadBlockedList();
                
                // 添加全局点击事件监听器来关闭导出菜单
                document.addEventListener('click', this.handleClickOutside);
                
                // 添加全局错误处理
                window.addEventListener('error', (event) => {
                    console.error('Global error caught:', event.error);
                    console.error('Error stack:', event.error?.stack);
                    console.error('Error filename:', event.filename);
                    console.error('Error lineno:', event.lineno);
                    console.error('Error colno:', event.colno);
                });
                
                // 添加未处理的Promise错误处理
                window.addEventListener('unhandledrejection', (event) => {
                    console.error('Unhandled promise rejection:', event.reason);
                    console.error('Promise stack:', event.reason?.stack);
                });
                
                console.log('Vue app mounted successfully');
            },
            
            beforeUnmount() {
                // 清理事件监听器
                document.removeEventListener('click', this.handleClickOutside);
            },
            methods: {
                handleClickOutside(event) {
                    // 简单的点击外部检测
                    const target = event.target;
                    const exportButton = target.closest('button');
                    
                    // 如果点击的是导出按钮，不关闭菜单
                    if (exportButton && exportButton.textContent && exportButton.textContent.includes('导出数据')) {
                        return;
                    }
                    
                    // 如果点击的不是导出菜单内部，关闭菜单
                    const exportMenu = target.closest('.absolute');
                    if (!exportMenu) {
                        this.showExportMenu = false;
                    }
                },
                
                async loadLinks(page = 1, limit = 20) {
                    this.loading = true;
                    const startTime = Date.now();

                    try {
                        const params = new URLSearchParams({
                            page: page.toString(),
                            limit: limit.toString(),
                            search: this.searchQuery || '',
                            sortBy: 'createdAt',
                            sortOrder: 'desc'
                        });

                        const response = await axios.get('/api/links?' + params);
                        if (response.data.success) {
                            this.links = response.data.data.links;
                            this.pagination = response.data.data.pagination;
                            this.meta = response.data.data.meta || {};
                            this.updateStats();

                            // 显示性能信息
                            const loadTime = Date.now() - startTime;
                            console.log('链接列表加载完成: ' + loadTime + 'ms, 缓存使用: ' + (this.meta.cacheUsed ? '是' : '否'));
                        }
                    } catch (error) {
                        console.error('Failed to load links:', error);
                        alert('加载链接列表失败，请重试');
                    } finally {
                        this.loading = false;
                    }
                },
                
                async createLink() {
                    this.creating = true;
                    try {
                        const response = await axios.post('/api/links', this.newLink);
                        if (response.data.success) {
                            // 重置表单
                            this.newLink = {
                                longUrl: '',
                                shortKey: '',
                                title: '',
                                description: '',
                                maxVisits: -1
                            };
                            // 重新加载链接列表
                            await this.loadLinks();
                            alert('链接创建成功！');
                        } else {
                            alert('创建失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('创建失败，请重试');
                    } finally {
                        this.creating = false;
                    }
                },
                
                async deleteLink(link) {
                    if (!confirm('确定要删除这个链接吗？')) return;
                    
                    try {
                        const response = await axios.delete('/api/links/' + link.short_key);
                        if (response.data.success) {
                            await this.loadLinks();
                            alert('删除成功');
                        } else {
                            alert('删除失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('删除失败，请重试');
                    }
                },
                
                editLink(link) {
                    // 解析自定义响应头
                    const customHeaders = link.custom_headers ? JSON.parse(link.custom_headers) : {};
                    const subscriptionInfo = this.parseSubscriptionUserinfo(customHeaders['subscription-userinfo']);
                    const contentDisposition = this.parseContentDisposition(customHeaders['content-disposition']);

                    // 过滤掉已处理的响应头，剩余的作为其他自定义响应头
                    const otherHeaders = { ...customHeaders };
                    delete otherHeaders['subscription-userinfo'];
                    delete otherHeaders['content-disposition'];

                    this.editingLink = {
                        id: link.id,
                        shortKey: link.short_key,
                        longUrl: link.long_url,
                        title: link.title || '',
                        description: link.description || '',
                        maxVisits: link.max_visits,
                        currentVisits: link.visit_count || 0,
                        expiryDays: '', // 重新设置有效期
                        password: '', // 不显示现有密码
                        accessMode: link.access_mode || 'redirect',
                        isActive: link.is_active !== false,
                        tagsString: (link.tags || []).join(', '),
                        subscriptionInfo: subscriptionInfo,
                        contentDisposition: contentDisposition,
                        customHeadersJson: Object.keys(otherHeaders).length > 0 ? JSON.stringify(otherHeaders, null, 2) : '',
                        // 添加风控配置
                        riskControl: {
                            visitLimits: {
                                total: -1,        // 总次数限制，-1表示无限制
                                device: -1,       // 同设备限制
                                ip: -1,          // 同IP限制
                                deviceIp: -1      // 同设备+IP限制
                            },
                            uaFilter: {
                                enabled: false,
                                whitelist: [],
                                blacklist: []
                            },
                            riskAlert: {
                                enabled: false,
                                webhook: '',
                                email: ''
                            },
                            countryRestriction: {
                                enabled: false,
                                allowed: [],
                                blocked: []
                            }
                        }
                    };
                    this.originalMaxVisits = link.max_visits;
                    this.originalShortKey = link.short_key;
                    
                    // 加载现有的风控配置
                    this.loadRiskControlConfig(link.id);
                    
                    this.showEditModal = true;
                },

                async loadRiskControlConfig(linkId) {
                    try {
                        const response = await axios.get('/api/links/' + this.editingLink.shortKey + '?risk-control=true');
                        if (response.data.success) {
                            this.editingLink.riskControl = response.data.data;
                        }
                    } catch (error) {
                        console.error('Failed to load risk control config:', error);
                        // 如果加载失败，使用默认配置
                    }
                },

                closeEditModal() {
                    this.showEditModal = false;
                    this.editingLink = {};
                    this.originalMaxVisits = 0;
                    this.originalShortKey = '';
                },

                async updateLink() {
                    this.updating = true;
                    try {
                        // 前端验证
                        const validationError = this.validateUpdateData();
                        if (validationError) {
                            alert(validationError);
                            return;
                        }

                        // 构建更新数据
                        const updateData = {
                            longUrl: this.editingLink.longUrl,
                            shortKey: this.editingLink.shortKey,
                            title: this.editingLink.title,
                            description: this.editingLink.description,
                            maxVisits: parseInt(this.editingLink.maxVisits),
                            currentVisits: parseInt(this.editingLink.currentVisits),
                            expiryDays: this.editingLink.expiryDays ? parseInt(this.editingLink.expiryDays) : null,
                            password: this.editingLink.password || null,
                            accessMode: this.editingLink.accessMode,
                            isActive: this.editingLink.isActive,
                            tags: this.editingLink.tagsString ? this.editingLink.tagsString.split(',').map(tag => tag.trim()).filter(tag => tag) : [],
                            subscriptionInfo: this.editingLink.subscriptionInfo,
                            contentDisposition: this.editingLink.contentDisposition,
                            // 添加风控配置
                            riskControl: this.editingLink.riskControl
                        };

                        // 处理其他自定义响应头
                        if (this.editingLink.customHeadersJson) {
                            try {
                                updateData.customHeaders = JSON.parse(this.editingLink.customHeadersJson);
                            } catch (e) {
                                alert('自定义响应头JSON格式错误，请检查');
                                return;
                            }
                        }

                        const response = await axios.put('/api/links/' + this.originalShortKey, updateData);
                        if (response.data.success) {
                            await this.loadLinks();
                            this.closeEditModal();
                            alert('链接更新成功！');
                        } else {
                            alert('更新失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        console.error('Update error:', error);
                        alert('更新失败，请重试');
                    } finally {
                        this.updating = false;
                    }
                },

                copyLink(link) {
                    const url = window.location.origin + '/' + link.short_key;
                    navigator.clipboard.writeText(url).then(() => {
                        alert('链接已复制到剪贴板');
                    });
                },
                
                searchLinks() {
                    // 防抖搜索
                    clearTimeout(this.searchTimeout);
                    this.searchTimeout = setTimeout(() => {
                        this.loadLinks(1, this.pagination.limit);
                    }, 300);
                },

                // 分页相关方法
                goToPage(page) {
                    if (page >= 1 && page <= this.pagination.totalPages) {
                        this.loadLinks(page, this.pagination.limit);
                    }
                },

                changePageSize(newSize) {
                    this.pagination.limit = newSize;
                    this.loadLinks(1, newSize);
                },

                // 清除缓存
                async clearCache() {
                    try {
                        // 这里可以添加一个专门的清除缓存API
                        await axios.delete('/api/cache/links');
                        alert('缓存已清除');
                        this.loadLinks();
                    } catch (error) {
                        console.error('Clear cache error:', error);
                        alert('清除缓存失败');
                    }
                },

                async exportLinks(format) {
                    this.exporting = true;
                    this.showExportMenu = false;
                    
                    try {
                        const params = new URLSearchParams({
                            format: format,
                            pageSize: '1000',
                            search: this.searchQuery || ''
                        });

                        const response = await axios.get('/api/links/export?' + params, {
                            responseType: 'blob'
                        });

                        // 创建下载链接
                        const blob = new Blob([response.data], {
                            type: format === 'csv' ? 'text/csv;charset=utf-8' : 'application/json'
                        });
                        
                        const url = window.URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        
                        // 从响应头获取文件名，如果没有则生成一个
                        const contentDisposition = response.headers['content-disposition'];
                        let filename = 'links_export_' + new Date().toISOString().slice(0, 19).replace(/[:-]/g, '') + '.' + format;
                        
                        if (contentDisposition) {
                            // 简化的文件名提取，避免复杂的正则表达式
                            const parts = contentDisposition.split(';');
                            for (const part of parts) {
                                if (part.trim().startsWith('filename=')) {
                                    let extractedFilename = part.substring(9).trim();
                                    // 移除引号
                                    extractedFilename = extractedFilename.replace(/^["']|["']$/g, '');
                                    if (extractedFilename) {
                                        filename = extractedFilename;
                                    }
                                    break;
                                }
                            }
                        }
                        
                        link.download = filename;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        window.URL.revokeObjectURL(url);

                        console.log('Export completed: ' + format + ' format');
                    } catch (error) {
                        console.error('Export error:', error);
                        alert('导出失败，请重试');
                    } finally {
                        this.exporting = false;
                    }
                },
                
                updateStats() {
                    // 使用API返回的统计数据
                    if (this.meta && this.meta.stats) {
                        this.stats.totalLinks = this.meta.stats.totalLinks || 0;
                        this.stats.totalVisits = this.meta.stats.totalVisits || 0;
                        this.stats.todayVisits = this.meta.stats.todayVisits || 0;
                        this.stats.activeLinks = this.links.filter(link => link.is_active !== false).length;
                    } else {
                        // 回退到本地计算
                        this.stats.totalLinks = this.links.length;
                        this.stats.totalVisits = this.links.reduce((sum, link) => sum + (link.visit_count || 0), 0);
                        this.stats.activeLinks = this.links.filter(link => link.is_active !== false).length;
                        this.stats.todayVisits = 0;
                    }
                },
                
                getStatusClass(link) {
                    if (link.is_active === false) return 'bg-gray-100 text-gray-800';
                    if (link.is_expired === 1) return 'bg-red-100 text-red-800';
                    if (link.is_limit_reached === 1) return 'bg-yellow-100 text-yellow-800';
                    return 'bg-green-100 text-green-800';
                },
                
                getStatusText(link) {
                    if (link.is_active === false) return '已禁用';
                    if (link.is_expired === 1) return '已过期';
                    if (link.is_limit_reached === 1) return '已达限制';
                    return '正常';
                },
                
                formatDate(dateString) {
                    return new Date(dateString).toLocaleString('zh-CN');
                },
                
                async logout() {
                    try {
                        await axios.post('/api/auth/logout');
                        window.location.reload();
                    } catch (error) {
                        console.error('Logout failed:', error);
                    }
                },

                // 解析subscription-userinfo响应头
                parseSubscriptionUserinfo(headerValue) {
                    if (!headerValue) {
                        return { upload: '', download: '', total: '', expire: '' };
                    }

                    const info = { upload: '', download: '', total: '', expire: '' };
                    const parts = headerValue.split(';').map(part => part.trim());

                    parts.forEach(part => {
                        const [key, value] = part.split('=');
                        if (key && value) {
                            switch (key.trim()) {
                                case 'upload':
                                    info.upload = (parseInt(value) / (1024 * 1024 * 1024)).toFixed(2);
                                    break;
                                case 'download':
                                    info.download = (parseInt(value) / (1024 * 1024 * 1024)).toFixed(2);
                                    break;
                                case 'total':
                                    info.total = (parseInt(value) / (1024 * 1024 * 1024)).toFixed(2);
                                    break;
                                case 'expire':
                                    const date = new Date(parseInt(value) * 1000);
                                    info.expire = date.toISOString().split('T')[0];
                                    break;
                            }
                        }
                    });

                    return info;
                },

                // 解析content-disposition响应头
                parseContentDisposition(headerValue) {
                    if (!headerValue) {
                        return { type: '', filename: '' };
                    }

                    const parts = headerValue.split(';').map(part => part.trim());
                    const result = { type: '', filename: '' };

                    if (parts[0]) {
                        result.type = parts[0];
                    }

                    parts.forEach(part => {
                        if (part.startsWith("filename*=UTF-8''")) {
                            result.filename = decodeURIComponent(part.substring(17));
                        }
                    });

                    return result;
                },

                // 验证更新数据
                validateUpdateData() {
                    // 验证URL格式
                    if (this.editingLink.longUrl) {
                        try {
                            const url = new URL(this.editingLink.longUrl);
                            const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
                            if (dangerousProtocols.includes(url.protocol.toLowerCase())) {
                                return '不允许使用危险的URL协议';
                            }
                        } catch (e) {
                            return 'URL格式不正确';
                        }
                    }

                    // 验证shortKey格式
                    if (this.editingLink.shortKey) {
                        const shortKey = this.editingLink.shortKey.trim();
                        if (shortKey.length < 2 || shortKey.length > 50) {
                            return '短链接别名长度必须在2-50个字符之间';
                        }

                        const validPattern = /^[a-zA-Z0-9_-]+$/;
                        if (!validPattern.test(shortKey)) {
                            return '短链接别名只能包含字母、数字、连字符和下划线';
                        }

                        const reservedKeys = ['api', 'admin', 'www', 'app', 'static', 'assets', 'public', 'private', 'system'];
                        if (reservedKeys.includes(shortKey.toLowerCase())) {
                            return '短链接别名 "' + shortKey + '" 是保留关键字，不能使用';
                        }
                    }

                    // 验证访问次数
                    if (this.editingLink.maxVisits !== undefined && this.editingLink.maxVisits !== '') {
                        const maxVisits = parseInt(this.editingLink.maxVisits);
                        if (isNaN(maxVisits) || (maxVisits < -1)) {
                            return '访问次数限制必须是-1或正整数';
                        }
                    }

                    if (this.editingLink.currentVisits !== undefined && this.editingLink.currentVisits !== '') {
                        const currentVisits = parseInt(this.editingLink.currentVisits);
                        if (isNaN(currentVisits) || currentVisits < 0) {
                            return '当前访问次数必须是非负整数';
                        }
                    }

                    // 验证有效期
                    if (this.editingLink.expiryDays !== undefined && this.editingLink.expiryDays !== '') {
                        const expiryDays = parseInt(this.editingLink.expiryDays);
                        if (isNaN(expiryDays) || expiryDays < 1) {
                            return '有效期必须是正整数';
                        }
                    }

                    // 验证自定义响应头JSON格式
                    if (this.editingLink.customHeadersJson) {
                        try {
                            const headers = JSON.parse(this.editingLink.customHeadersJson);
                            if (typeof headers !== 'object' || Array.isArray(headers)) {
                                return '自定义响应头必须是JSON对象格式';
                            }
                        } catch (e) {
                            return '自定义响应头JSON格式错误';
                        }
                    }

                    return null; // 验证通过
                },

                // 风控管理方法
                async loadBlockedList() {
                    try {
                        const response = await axios.get('/api/risk-control?action=get-blocked');
                        if (response.data.success) {
                            this.blockedDevices = response.data.data.blockedDevices;
                            this.blockedIPs = response.data.data.blockedIPs;
                        }
                    } catch (error) {
                        console.error('Failed to load blocked list:', error);
                    }
                },

                async blockDevice() {
                    if (!this.blockDeviceForm.deviceId || !this.blockDeviceForm.reason) {
                        alert('请填写设备ID和封禁原因');
                        return;
                    }

                    this.blockingDevice = true;
                    try {
                        const response = await axios.post('/api/risk-control?action=block-device', {
                            deviceId: this.blockDeviceForm.deviceId,
                            reason: this.blockDeviceForm.reason,
                            duration: this.blockDeviceForm.duration ? parseInt(this.blockDeviceForm.duration) : null
                        });

                        if (response.data.success) {
                            alert('设备封禁成功');
                            this.blockDeviceForm = { deviceId: '', reason: '', duration: '' };
                            this.loadBlockedList();
                        } else {
                            alert('封禁失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('封禁失败，请重试');
                    } finally {
                        this.blockingDevice = false;
                    }
                },

                async blockIP() {
                    if (!this.blockIPForm.ipAddress || !this.blockIPForm.reason) {
                        alert('请填写IP地址和封禁原因');
                        return;
                    }

                    this.blockingIP = true;
                    try {
                        const response = await axios.post('/api/risk-control?action=block-ip', {
                            ipAddress: this.blockIPForm.ipAddress,
                            reason: this.blockIPForm.reason,
                            duration: this.blockIPForm.duration ? parseInt(this.blockIPForm.duration) : null
                        });

                        if (response.data.success) {
                            alert('IP封禁成功');
                            this.blockIPForm = { ipAddress: '', reason: '', duration: '' };
                            this.loadBlockedList();
                        } else {
                            alert('封禁失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('封禁失败，请重试');
                    } finally {
                        this.blockingIP = false;
                    }
                },

                async unblockDevice(deviceId) {
                    if (!confirm('确定要解封这个设备吗？')) return;

                    try {
                        const response = await axios.post('/api/risk-control?action=unblock-device', {
                            deviceId: deviceId
                        });

                        if (response.data.success) {
                            alert('设备解封成功');
                            this.loadBlockedList();
                        } else {
                            alert('解封失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('解封失败，请重试');
                    }
                },

                async unblockIP(ipAddress) {
                    if (!confirm('确定要解封这个IP吗？')) return;

                    try {
                        const response = await axios.post('/api/risk-control?action=unblock-ip', {
                            ipAddress: ipAddress
                        });

                        if (response.data.success) {
                            alert('IP解封成功');
                            this.loadBlockedList();
                        } else {
                            alert('解封失败: ' + response.data.error.message);
                        }
                    } catch (error) {
                        alert('解封失败，请重试');
                    }
                },

                // 查看访问记录
                viewAccessLogs(link) {
                    // 打开新标签页显示访问记录页面
                    const url = '/access-logs?shortKey=' + link.short_key;
                    window.open(url, '_blank');
                },

                // 格式化日期
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

                // 格式化访问统计
                formatVisitStats(link) {
                    if (!link) return '总计: 0';
                    const total = link.visit_count || 0;
                    const today = link.today_visits || 0;
                    return '总计: ' + total + (today > 0 ? ' (今日: ' + today + ')' : '');
                }
            }
        }).mount('#app');
    </script>
</body>
</html>`;
}
