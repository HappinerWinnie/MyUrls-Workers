// 单个链接管理API - 获取、更新、删除
/**
 * 作者: wei
 * 日期: 2025-08-14
 * 功能: 支持所有前台字段的完整修改功能
 */
import {
  successResponse,
  errorResponse,
  optionsResponse,
  unauthorizedResponse,
  notFoundResponse
} from '../../utils/response.js';
import {
  getCurrentTimestamp,
  hashPassword,
  isExpired,
  isValidUrl,
  sanitizeUrl,
  generateRandomKey
} from '../../utils/crypto.js';
import { authMiddleware } from '../../utils/auth.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const kv = env.LINKS;
  const shortKey = params.shortKey;

  // 处理OPTIONS预检请求
  if (request.method === 'OPTIONS') {
    return optionsResponse();
  }

  // 检查KV存储
  if (!kv) {
    return errorResponse('KV storage not configured', 500, 500);
  }

  // 检查认证
  const auth = await authMiddleware(request, env, kv);
  if (!auth || !auth.isAuthenticated) {
    return unauthorizedResponse('Authentication required');
  }

  // 获取链接数据
  const linkDataStr = await kv.get(shortKey);
  if (!linkDataStr) {
    return notFoundResponse('Link not found');
  }

  let linkData;
  try {
    linkData = JSON.parse(linkDataStr);
  } catch (error) {
    return errorResponse('Invalid link data format', 500, 500);
  }

  switch (request.method) {
    case 'GET':
      return await getLinkDetails(linkData);
    case 'PUT':
      return await updateLink(request, kv, linkData);
    case 'DELETE':
      return await deleteLink(kv, shortKey);
    default:
      return errorResponse('Method not allowed', 405, 405);
  }
}

/**
 * 获取链接详情
 */
async function getLinkDetails(linkData) {
  try {
    // 计算链接状态
    const isExpiredLink = linkData.expiresAt && isExpired(linkData.expiresAt);
    const isLimitReached = linkData.maxVisits > 0 && linkData.currentVisits >= linkData.maxVisits;

    const details = {
      id: linkData.id,
      shortKey: linkData.shortKey,
      longUrl: linkData.longUrl,
      title: linkData.title,
      description: linkData.description,
      maxVisits: linkData.maxVisits,
      currentVisits: linkData.currentVisits,
      totalVisits: linkData.totalVisits,
      expiresAt: linkData.expiresAt,
      accessMode: linkData.accessMode,
      tags: linkData.tags,
      isActive: linkData.isActive,
      createdAt: linkData.createdAt,
      updatedAt: linkData.updatedAt,
      createdBy: linkData.createdBy,
      lastVisitAt: linkData.lastVisitAt,
      visitHistory: linkData.visitHistory || [],
      hasPassword: !!linkData.password,
      status: {
        isExpired: isExpiredLink,
        isLimitReached: isLimitReached,
        isAccessible: linkData.isActive && !isExpiredLink && !isLimitReached
      }
    };

    return successResponse(details);
  } catch (error) {
    console.error('Get link details error:', error);
    return errorResponse('Failed to get link details', 500, 500);
  }
}

/**
 * 更新链接 - 支持所有前台字段的修改
 */
async function updateLink(request, kv, linkData) {
  try {
    const contentType = request.headers.get('Content-Type');
    let updateData;

    if (contentType && contentType.includes('application/json')) {
      updateData = await request.json();
    } else {
      const formData = await request.formData();
      updateData = {
        longUrl: formData.get('longUrl'),
        shortKey: formData.get('shortKey'),
        title: formData.get('title'),
        description: formData.get('description'),
        password: formData.get('password'),
        maxVisits: formData.get('maxVisits'),
        expiryDays: formData.get('expiryDays'),
        accessMode: formData.get('accessMode'),
        tags: formData.get('tags'),
        isActive: formData.get('isActive'),
        customHeaders: formData.get('customHeaders')
      };
    }

    // 验证和处理longUrl修改
    if (updateData.longUrl !== undefined && updateData.longUrl !== linkData.longUrl) {
      const newLongUrl = sanitizeUrl(updateData.longUrl);
      if (!isValidUrl(newLongUrl)) {
        return errorResponse('Invalid URL format', 400);
      }

      // 安全检查：防止恶意URL
      const urlObj = new URL(newLongUrl);
      const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:'];
      if (dangerousProtocols.includes(urlObj.protocol.toLowerCase())) {
        return errorResponse('Dangerous URL protocol not allowed', 400);
      }

      linkData.longUrl = newLongUrl;
    }

    // 验证和处理shortKey修改
    if (updateData.shortKey !== undefined && updateData.shortKey !== linkData.shortKey) {
      const newShortKey = updateData.shortKey.trim();

      // 验证shortKey格式
      if (!newShortKey) {
        return errorResponse('Short key cannot be empty', 400);
      }

      if (newShortKey.length < 2 || newShortKey.length > 50) {
        return errorResponse('Short key must be between 2 and 50 characters', 400);
      }

      // 检查是否包含非法字符
      const validPattern = /^[a-zA-Z0-9_-]+$/;
      if (!validPattern.test(newShortKey)) {
        return errorResponse('Short key can only contain letters, numbers, hyphens and underscores', 400);
      }

      // 检查保留关键字
      const reservedKeys = ['api', 'admin', 'www', 'app', 'static', 'assets', 'public', 'private', 'system'];
      if (reservedKeys.includes(newShortKey.toLowerCase())) {
        return errorResponse(`Short key "${newShortKey}" is reserved`, 400);
      }

      // 检查新的shortKey是否已存在
      const existingLink = await kv.get(newShortKey);
      if (existingLink) {
        return errorResponse(`Short key "${newShortKey}" already exists`, 409);
      }

      // 删除旧的key，使用新的key保存
      await kv.delete(linkData.shortKey);
      linkData.shortKey = newShortKey;
    }

    // 更新基础字段
    if (updateData.title !== undefined) {
      linkData.title = updateData.title;
    }

    if (updateData.description !== undefined) {
      linkData.description = updateData.description;
    }

    if (updateData.password !== undefined) {
      if (updateData.password) {
        linkData.password = await hashPassword(updateData.password);
      } else {
        linkData.password = null;
      }
    }

    if (updateData.maxVisits !== undefined) {
      const maxVisits = parseInt(updateData.maxVisits);
      linkData.maxVisits = isNaN(maxVisits) ? -1 : maxVisits;
    }

    if (updateData.currentVisits !== undefined) {
      const currentVisits = parseInt(updateData.currentVisits);
      linkData.currentVisits = isNaN(currentVisits) ? 0 : Math.max(0, currentVisits);
    }

    if (updateData.expiryDays !== undefined) {
      if (updateData.expiryDays && parseInt(updateData.expiryDays) > 0) {
        const days = parseInt(updateData.expiryDays);
        linkData.expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      } else {
        linkData.expiresAt = null;
      }
    }

    if (updateData.accessMode !== undefined) {
      linkData.accessMode = updateData.accessMode;
    }

    if (updateData.tags !== undefined) {
      if (Array.isArray(updateData.tags)) {
        linkData.tags = updateData.tags;
      } else if (typeof updateData.tags === 'string') {
        linkData.tags = updateData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      }
    }

    if (updateData.isActive !== undefined) {
      linkData.isActive = Boolean(updateData.isActive);
    }

    // 处理自定义响应头
    if (updateData.customHeaders !== undefined) {
      if (typeof updateData.customHeaders === 'object' && updateData.customHeaders !== null) {
        linkData.customHeaders = updateData.customHeaders;
      } else if (typeof updateData.customHeaders === 'string') {
        try {
          linkData.customHeaders = JSON.parse(updateData.customHeaders);
        } catch (e) {
          return errorResponse('Invalid custom headers format', 400);
        }
      }
    }

    // 处理subscription-userinfo响应头（从前台传来的格式）
    if (updateData.subscriptionInfo !== undefined) {
      const subscriptionUserinfo = buildSubscriptionUserinfo(updateData.subscriptionInfo);
      if (subscriptionUserinfo) {
        if (!linkData.customHeaders) linkData.customHeaders = {};
        linkData.customHeaders['subscription-userinfo'] = subscriptionUserinfo;
      } else {
        if (linkData.customHeaders) {
          delete linkData.customHeaders['subscription-userinfo'];
        }
      }
    }

    // 处理content-disposition响应头（从前台传来的格式）
    if (updateData.contentDisposition !== undefined) {
      const contentDisposition = buildContentDisposition(updateData.contentDisposition);
      if (contentDisposition) {
        if (!linkData.customHeaders) linkData.customHeaders = {};
        linkData.customHeaders['content-disposition'] = contentDisposition;
      } else {
        if (linkData.customHeaders) {
          delete linkData.customHeaders['content-disposition'];
        }
      }
    }

    // 更新时间戳
    linkData.updatedAt = getCurrentTimestamp();

    // 保存更新后的数据
    await kv.put(linkData.shortKey, JSON.stringify(linkData));

    // 清除链接索引缓存
    await invalidateLinksCache(kv);

    return successResponse({
      id: linkData.id,
      shortKey: linkData.shortKey,
      longUrl: linkData.longUrl,
      title: linkData.title,
      description: linkData.description,
      maxVisits: linkData.maxVisits,
      currentVisits: linkData.currentVisits,
      expiresAt: linkData.expiresAt,
      accessMode: linkData.accessMode,
      customHeaders: linkData.customHeaders,
      tags: linkData.tags,
      isActive: linkData.isActive,
      updatedAt: linkData.updatedAt
    }, 'Link updated successfully');

  } catch (error) {
    console.error('Update link error:', error);
    return errorResponse('Failed to update link', 500, 500);
  }
}

/**
 * 删除链接
 */
async function deleteLink(kv, shortKey) {
  try {
    // 删除链接数据
    await kv.delete(shortKey);

    // 删除相关的统计数据（如果有的话）
    const { keys } = await kv.list({ prefix: `stats:${shortKey}:` });
    for (const key of keys) {
      await kv.delete(key.name);
    }

    // 清除链接索引缓存
    await invalidateLinksCache(kv);

    return successResponse(null, 'Link deleted successfully');

  } catch (error) {
    console.error('Delete link error:', error);
    return errorResponse('Failed to delete link', 500, 500);
  }
}

/**
 * 构建subscription-userinfo响应头
 */
function buildSubscriptionUserinfo(subscriptionInfo) {
  if (!subscriptionInfo || typeof subscriptionInfo !== 'object') {
    return null;
  }

  const { upload, download, total, expire } = subscriptionInfo;
  if (!upload && !download && !total && !expire) {
    return null;
  }

  const parts = [];

  // 转换GB到字节
  if (upload) {
    const uploadBytes = Math.round(parseFloat(upload) * 1024 * 1024 * 1024);
    parts.push(`upload=${uploadBytes}`);
  } else {
    parts.push('upload=0');
  }

  if (download) {
    const downloadBytes = Math.round(parseFloat(download) * 1024 * 1024 * 1024);
    parts.push(`download=${downloadBytes}`);
  } else {
    parts.push('download=0');
  }

  if (total) {
    const totalBytes = Math.round(parseFloat(total) * 1024 * 1024 * 1024);
    parts.push(`total=${totalBytes}`);
  }

  if (expire) {
    const expireTimestamp = Math.floor(new Date(expire).getTime() / 1000);
    parts.push(`expire=${expireTimestamp}`);
  }

  return parts.join('; ');
}

/**
 * 构建content-disposition响应头
 */
function buildContentDisposition(contentDisposition) {
  if (!contentDisposition || typeof contentDisposition !== 'object') {
    return null;
  }

  const { type, filename } = contentDisposition;
  if (!type || !filename) {
    return null;
  }

  // URL编码文件名
  const encodedFilename = encodeURIComponent(filename);
  return `${type}; filename*=UTF-8''${encodedFilename}`;
}

/**
 * 清除链接缓存
 */
async function invalidateLinksCache(kv) {
  try {
    await kv.delete('links:index');
    console.log('Links cache invalidated');
  } catch (error) {
    console.error('Failed to invalidate links cache:', error);
  }
}
