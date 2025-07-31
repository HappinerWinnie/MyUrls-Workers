// HTTP响应工具函数

/**
 * CORS 头部配置
 */
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Access-Control-Max-Age': '86400',
};

/**
 * 创建JSON响应
 * @param {Object} data 响应数据
 * @param {number} status HTTP状态码
 * @param {Object} headers 额外的头部
 * @returns {Response} Response对象
 */
export function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...headers
    }
  });
}

/**
 * 创建成功响应
 * @param {Object} data 数据
 * @param {string} message 消息
 * @returns {Response} Response对象
 */
export function successResponse(data = null, message = 'Success') {
  return jsonResponse({
    success: true,
    message,
    data
  });
}

/**
 * 创建错误响应
 * @param {string} message 错误消息
 * @param {number} code 错误代码
 * @param {number} status HTTP状态码
 * @returns {Response} Response对象
 */
export function errorResponse(message, code = 400, status = 400) {
  return jsonResponse({
    success: false,
    error: {
      code,
      message
    }
  }, status);
}

/**
 * 创建重定向响应
 * @param {string} url 重定向URL
 * @param {number} status 状态码 (301, 302, 307, 308)
 * @returns {Response} Response对象
 */
export function redirectResponse(url, status = 301) {
  return new Response(null, {
    status,
    headers: {
      'Location': url,
      ...CORS_HEADERS
    }
  });
}

/**
 * 创建HTML响应
 * @param {string} html HTML内容
 * @param {number} status HTTP状态码
 * @returns {Response} Response对象
 */
export function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      ...CORS_HEADERS
    }
  });
}

/**
 * 处理OPTIONS预检请求
 * @returns {Response} Response对象
 */
export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
}

/**
 * 创建未授权响应
 * @param {string} message 错误消息
 * @returns {Response} Response对象
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return errorResponse(message, 401, 401);
}

/**
 * 创建禁止访问响应
 * @param {string} message 错误消息
 * @returns {Response} Response对象
 */
export function forbiddenResponse(message = 'Forbidden') {
  return errorResponse(message, 403, 403);
}

/**
 * 创建未找到响应
 * @param {string} message 错误消息
 * @returns {Response} Response对象
 */
export function notFoundResponse(message = 'Not Found') {
  return errorResponse(message, 404, 404);
}

/**
 * 创建方法不允许响应
 * @param {string} message 错误消息
 * @returns {Response} Response对象
 */
export function methodNotAllowedResponse(message = 'Method Not Allowed') {
  return errorResponse(message, 405, 405);
}

/**
 * 创建服务器错误响应
 * @param {string} message 错误消息
 * @returns {Response} Response对象
 */
export function serverErrorResponse(message = 'Internal Server Error') {
  return errorResponse(message, 500, 500);
}
