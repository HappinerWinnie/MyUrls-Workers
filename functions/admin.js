// 管理后台页面
import { htmlResponse, redirectResponse } from './utils/response.js';
import { authMiddleware } from './utils/auth.js';

export async function onRequest(context) {
  const { request, env } = context;
  const kv = env.LINKS;

  if (!kv) {
    return htmlResponse("Service not configured", 500);
  }

  // 检查认证
  const auth = await authMiddleware(request, env, kv);
  
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
                                            <a :href="'/' + link.shortKey" target="_blank">{{ link.shortKey }}</a>
                                        </div>
                                        <div v-if="link.title" class="text-sm text-gray-500">{{ link.title }}</div>
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="text-sm text-gray-900 max-w-xs truncate" :title="link.longUrl">
                                            {{ link.longUrl }}
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        <div>{{ link.currentVisits }}{{ link.maxVisits > 0 ? '/' + link.maxVisits : '' }}</div>
                                        <div class="text-xs text-gray-500">总计: {{ link.totalVisits }}</div>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        <span :class="getStatusClass(link)" class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full">
                                            {{ getStatusText(link) }}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {{ formatDate(link.createdAt) }}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
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
                                        <a :href="'/' + link.shortKey" target="_blank">{{ link.shortKey }}</a>
                                    </div>
                                    <div v-if="link.title" class="text-sm text-gray-500 truncate">{{ link.title }}</div>
                                </div>
                                <span :class="getStatusClass(link)" class="px-2 py-1 text-xs font-semibold rounded-full ml-2">
                                    {{ getStatusText(link) }}
                                </span>
                            </div>

                            <div class="text-sm text-gray-900 mb-2 truncate" :title="link.longUrl">
                                <span class="font-medium">目标:</span> {{ link.longUrl }}
                            </div>

                            <div class="flex justify-between items-center text-sm text-gray-500 mb-3">
                                <div>
                                    <span class="font-medium">访问:</span>
                                    {{ link.currentVisits }}{{ link.maxVisits > 0 ? '/' + link.maxVisits : '' }}
                                    (总计: {{ link.totalVisits }})
                                </div>
                                <div>{{ formatDate(link.createdAt) }}</div>
                            </div>

                            <div class="flex space-x-3">
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
                    searchQuery: '',
                    newLink: {
                        longUrl: '',
                        shortKey: '',
                        title: '',
                        description: '',
                        maxVisits: -1
                    }
                }
            },
            mounted() {
                this.loadLinks();
            },
            methods: {
                async loadLinks() {
                    this.loading = true;
                    try {
                        const response = await axios.get('/api/links');
                        if (response.data.success) {
                            this.links = response.data.data.links;
                            this.updateStats();
                        }
                    } catch (error) {
                        console.error('Failed to load links:', error);
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
                        const response = await axios.delete(\`/api/links/\${link.shortKey}\`);
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
                
                copyLink(link) {
                    const url = window.location.origin + '/' + link.shortKey;
                    navigator.clipboard.writeText(url).then(() => {
                        alert('链接已复制到剪贴板');
                    });
                },
                
                searchLinks() {
                    // 实现搜索功能
                    this.loadLinks();
                },
                
                updateStats() {
                    this.stats.totalLinks = this.links.length;
                    this.stats.totalVisits = this.links.reduce((sum, link) => sum + link.totalVisits, 0);
                    this.stats.activeLinks = this.links.filter(link => link.isActive).length;
                    
                    // 计算今日访问量（简化实现）
                    const today = new Date().toDateString();
                    this.stats.todayVisits = this.links.reduce((sum, link) => {
                        if (link.lastVisitAt && new Date(link.lastVisitAt).toDateString() === today) {
                            return sum + 1;
                        }
                        return sum;
                    }, 0);
                },
                
                getStatusClass(link) {
                    if (!link.isActive) return 'bg-gray-100 text-gray-800';
                    if (link.expiresAt && new Date(link.expiresAt) < new Date()) return 'bg-red-100 text-red-800';
                    if (link.maxVisits > 0 && link.currentVisits >= link.maxVisits) return 'bg-yellow-100 text-yellow-800';
                    return 'bg-green-100 text-green-800';
                },
                
                getStatusText(link) {
                    if (!link.isActive) return '已禁用';
                    if (link.expiresAt && new Date(link.expiresAt) < new Date()) return '已过期';
                    if (link.maxVisits > 0 && link.currentVisits >= link.maxVisits) return '已达限制';
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
                }
            }
        }).mount('#app');
    </script>
</body>
</html>`;
}
