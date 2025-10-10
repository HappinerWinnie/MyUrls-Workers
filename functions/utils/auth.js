// 认证工具函数
import { generateSessionToken, verifyPassword } from './crypto.js';

/**
 * 检查管理员密码
 * @param {string} password 输入的密码
 * @param {string} envPassword 环境变量中的密码
 * @returns {boolean} 是否匹配
 */
export function checkAdminPassword(password, envPassword) {
  return password === envPassword;
}

/**
 * 创建会话
 * @param {Object} kv KV存储实例
 * @param {string} userId 用户ID
 * @returns {Promise<string>} 会话令牌
 */
export async function createSession(kv, userId = 'admin') {
  const sessionToken = generateSessionToken();
  const sessionData = {
    sessionId: sessionToken,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24小时后过期
    isValid: true
  };
  
  await kv.put(`session:${sessionToken}`, JSON.stringify(sessionData), {
    expirationTtl: 24 * 60 * 60 // 24小时TTL
  });
  
  return sessionToken;
}

/**
 * 验证会话
 * @param {Object} kv KV存储实例
 * @param {string} sessionToken 会话令牌
 * @returns {Promise<Object|null>} 会话数据或null
 */
export async function validateSession(kv, sessionToken) {
  if (!sessionToken) {
    return null;
  }
  
  const sessionData = await kv.get(`session:${sessionToken}`);
  if (!sessionData) {
    return null;
  }
  
  const session = JSON.parse(sessionData);
  
  // 检查会话是否过期
  if (new Date(session.expiresAt) < new Date()) {
    await kv.delete(`session:${sessionToken}`);
    return null;
  }
  
  return session;
}

/**
 * 销毁会话
 * @param {Object} kv KV存储实例
 * @param {string} sessionToken 会话令牌
 * @returns {Promise<void>}
 */
export async function destroySession(kv, sessionToken) {
  if (sessionToken) {
    await kv.delete(`session:${sessionToken}`);
  }
}

/**
 * 从请求中获取会话令牌
 * @param {Request} request 请求对象
 * @returns {string|null} 会话令牌
 */
export function getSessionTokenFromRequest(request) {
  // 从Cookie中获取
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    if (cookies.session) {
      return cookies.session;
    }
  }
  
  // 从Authorization头中获取
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

/**
 * 设置会话Cookie
 * @param {string} sessionToken 会话令牌
 * @returns {string} Cookie字符串
 */
export function setSessionCookie(sessionToken) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toUTCString();
  return `session=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expires}`;
}

/**
 * 清除会话Cookie
 * @returns {string} Cookie字符串
 */
export function clearSessionCookie() {
  return 'session=; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
}

/**
 * 检查是否需要认证
 * @param {Object} env 环境变量
 * @returns {boolean} 是否需要认证
 */
export function requiresAuth(env) {
  return env.REQUIRE_AUTH !== 'false';
}

/**
 * 中间件：检查认证
 * @param {Request} request 请求对象
 * @param {Object} env 环境变量
 * @param {Object} db D1数据库实例
 * @returns {Promise<Object|null>} 会话数据或null
 */
export async function authMiddleware(request, env, db) {
  if (!requiresAuth(env)) {
    return { userId: 'anonymous', isAuthenticated: true };
  }
  
  const sessionToken = getSessionTokenFromRequest(request);
  const session = await validateSessionD1(db, sessionToken);
  
  if (!session) {
    return null;
  }
  
  return {
    ...session,
    isAuthenticated: true
  };
}

/**
 * 使用D1数据库验证会话
 * @param {Object} db D1数据库实例
 * @param {string} sessionToken 会话令牌
 * @returns {Promise<Object|null>} 会话数据或null
 */
export async function validateSessionD1(db, sessionToken) {
  if (!sessionToken) {
    return null;
  }
  
  try {
    const result = await db.prepare('SELECT * FROM sessions WHERE session_id = ? AND is_valid = 1 AND expires_at > ?')
      .bind(sessionToken, new Date().toISOString())
      .first();
    
    if (!result) {
      return null;
    }
    
    return {
      sessionId: result.session_id,
      userId: result.user_id,
      createdAt: result.created_at,
      expiresAt: result.expires_at,
      isValid: result.is_valid
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}

/**
 * 使用D1数据库创建会话
 * @param {Object} db D1数据库实例
 * @param {string} userId 用户ID
 * @returns {Promise<string>} 会话令牌
 */
export async function createSessionD1(db, userId = 'admin') {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  
  try {
    await db.prepare(`
      INSERT INTO sessions (session_id, user_id, created_at, expires_at, is_valid)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      sessionToken,
      userId,
      new Date().toISOString(),
      expiresAt,
      1
    ).run();
    
    return sessionToken;
  } catch (error) {
    console.error('Session creation error:', error);
    throw error;
  }
}

/**
 * 使用D1数据库销毁会话
 * @param {Object} db D1数据库实例
 * @param {string} sessionToken 会话令牌
 * @returns {Promise<void>}
 */
export async function destroySessionD1(db, sessionToken) {
  if (!sessionToken) {
    return;
  }
  
  try {
    await db.prepare('UPDATE sessions SET is_valid = 0 WHERE session_id = ?')
      .bind(sessionToken)
      .run();
  } catch (error) {
    console.error('Session destruction error:', error);
  }
}
