// 加密和哈希工具函数

/**
 * 生成随机字符串
 * @param {number} length 长度
 * @returns {string} 随机字符串
 */
export function generateRandomKey(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * 生成UUID
 * @returns {string} UUID
 */
export function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 简单的密码哈希（使用Web Crypto API会更安全，但这里为了兼容性使用简单方法）
 * @param {string} password 密码
 * @param {string} salt 盐值
 * @returns {Promise<string>} 哈希值
 */
export async function hashPassword(password, salt = null) {
  if (!salt) {
    salt = generateRandomKey(16);
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${salt}:${hashHex}`;
}

/**
 * 验证密码
 * @param {string} password 输入的密码
 * @param {string} hashedPassword 存储的哈希密码
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(password, hashedPassword) {
  const [salt, hash] = hashedPassword.split(':');
  const newHash = await hashPassword(password, salt);
  return newHash === hashedPassword;
}

/**
 * Base64 编码
 * @param {string} str 字符串
 * @returns {string} Base64编码
 */
export function encodeBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Base64 解码
 * @param {string} str Base64字符串
 * @returns {string} 解码后的字符串
 */
export function decodeBase64(str) {
  try {
    return decodeURIComponent(escape(atob(str)));
  } catch (error) {
    throw new Error('Invalid Base64 encoding');
  }
}

/**
 * 生成会话令牌
 * @returns {string} 会话令牌
 */
export function generateSessionToken() {
  return generateRandomKey(32);
}

/**
 * 验证URL格式
 * @param {string} url URL字符串
 * @returns {boolean} 是否为有效URL
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * 清理和标准化URL
 * @param {string} url 原始URL
 * @returns {string} 清理后的URL
 */
export function sanitizeUrl(url) {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url;
  }
  return url.trim();
}

/**
 * 获取当前时间戳（ISO格式）
 * @returns {string} ISO时间戳
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * 检查是否过期
 * @param {string} expiresAt 过期时间
 * @returns {boolean} 是否过期
 */
export function isExpired(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt) < new Date();
}
