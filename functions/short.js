// 导入新的工具函数
import {
    generateRandomKey,
    generateUUID,
    isValidUrl,
    sanitizeUrl,
    getCurrentTimestamp
} from './utils/crypto.js';

export async function onRequest(context) {
    const { request, env } = context;
    const kv = env.LINKS;

    // CORS 头部配置
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Content-Type': 'application/json'
    };

    // 检查 kv 是否有值
    if (!kv) {
        return new Response(JSON.stringify({
            Code: 201,
            Message: '请去Pages控制台-设置 将变量名称设定为“LINKS”并绑定KV命名空间然后重试部署！'
        }), {
            status: 200,
            headers: corsHeaders
        });
    }

    const method = request.method;
    let longUrl, shortKey;

    // 处理 OPTIONS 请求（CORS 预检请求）
    if (method === "OPTIONS") {
        return new Response(null, {
            status: 204, // 无内容
            headers: corsHeaders
        });
    }

    // 处理 GET 请求
    if (method === "GET") {
        const url = new URL(request.url);
        longUrl = url.searchParams.get('longUrl');
        shortKey = url.searchParams.get('shortKey');

        if (!longUrl) {
            return new Response(JSON.stringify({
                Code: 201,
                Message: "No longUrl provided"
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        try {
            longUrl = decodeBase64(longUrl);
        } catch {
            return new Response(JSON.stringify({
                Code: 201,
                Message: "Invalid Base64 encoding for longUrl"
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        return await handleUrlStorage(kv, longUrl, shortKey);
    } 
    
    // 处理 POST 请求
    else if (method === "POST") {
        const formData = await request.formData();
        longUrl = formData.get('longUrl');
        shortKey = formData.get('shortKey');

        if (!longUrl) {
            return new Response(JSON.stringify({
                Code: 201,
                Message: "No longUrl provided"
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        try {
            longUrl = decodeBase64(longUrl);
        } catch {
            return new Response(JSON.stringify({
                Code: 201,
                Message: "Invalid Base64 encoding for longUrl"
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        return await handleUrlStorage(kv, longUrl, shortKey);
    }

    // 不支持的请求方法
    return new Response(JSON.stringify({
        Code: 405,
        Message: "Method not allowed"
    }), {
        status: 405,
        headers: corsHeaders
    });

    /**
     * 处理 URL 存储逻辑 - 更新为新的数据结构
     */
    async function handleUrlStorage(kv, longUrl, shortKey) {
        // 验证和清理URL
        longUrl = sanitizeUrl(longUrl);
        if (!isValidUrl(longUrl)) {
            return new Response(JSON.stringify({
                Code: 201,
                Message: "Invalid URL format"
            }), {
                status: 200,
                headers: corsHeaders
            });
        }

        if (shortKey) {
            const existingValue = await kv.get(shortKey);
            if (existingValue) {
                return new Response(JSON.stringify({
                    Code: 201,
                    Message: `The custom shortKey \"${shortKey}\" already exists.`
                }), {
                    status: 200,
                    headers: corsHeaders
                });
            }
        } else {
            // 生成随机key，确保不重复
            do {
                shortKey = generateRandomKey(6);
            } while (await kv.get(shortKey));
        }

        // 创建新的数据结构
        const linkData = {
            id: generateUUID(),
            longUrl,
            shortKey,
            title: '',
            description: '',
            password: null,
            maxVisits: -1, // 无限制
            currentVisits: 0,
            expiresAt: null,
            accessMode: 'redirect',
            createdAt: getCurrentTimestamp(),
            updatedAt: getCurrentTimestamp(),
            createdBy: 'anonymous',
            tags: [],
            isActive: true,
            totalVisits: 0,
            lastVisitAt: null,
            visitHistory: []
        };

        await kv.put(shortKey, JSON.stringify(linkData));
        const shortUrl = `https://${request.headers.get("host")}/${shortKey}`;
        return new Response(JSON.stringify({
            Code: 1,
            Message: "URL stored successfully",
            ShortUrl: shortUrl,
            LongUrl: longUrl,
            ShortKey: shortKey
        }), {
            status: 200,
            headers: corsHeaders
        });
    }

    /**
     * 生成一个随机六位字符串（字母+数字）
     */
    function generateRandomKey(length) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    }

    /**
     * Base64 解码函数
     */
    function decodeBase64(encodedString) {
        return atob(encodedString);
    }
}
