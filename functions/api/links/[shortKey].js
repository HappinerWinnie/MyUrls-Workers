// 单个链接管理API - 获取、更新、删除
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
  isExpired 
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
 * 更新链接
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
        title: formData.get('title'),
        description: formData.get('description'),
        password: formData.get('password'),
        maxVisits: formData.get('maxVisits'),
        expiryDays: formData.get('expiryDays'),
        accessMode: formData.get('accessMode'),
        tags: formData.get('tags'),
        isActive: formData.get('isActive')
      };
    }

    // 更新字段
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

    // 更新时间戳
    linkData.updatedAt = getCurrentTimestamp();

    // 保存更新后的数据
    await kv.put(linkData.shortKey, JSON.stringify(linkData));

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

    return successResponse(null, 'Link deleted successfully');

  } catch (error) {
    console.error('Delete link error:', error);
    return errorResponse('Failed to delete link', 500, 500);
  }
}
