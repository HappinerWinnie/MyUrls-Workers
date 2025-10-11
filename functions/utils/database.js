// D1数据库操作工具类
import { getCurrentTimestamp } from './crypto.js';

/**
 * 数据库操作基类
 */
export class Database {
  constructor(db) {
    this.db = db;
  }

  /**
   * 执行查询
   */
  async query(sql, params = []) {
    try {
      console.log('Database query:', { sql, params });
      const result = await this.db.prepare(sql).bind(...params).all();
      console.log('Database query result:', { 
        success: result.success, 
        meta: result.meta, 
        resultsCount: result.results?.length || 0 
      });
      return result.results || [];
    } catch (error) {
      console.error('Database query error:', {
        message: error.message,
        stack: error.stack,
        sql,
        params,
        error: error
      });
      throw error;
    }
  }

  /**
   * 执行单行查询
   */
  async queryFirst(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).first();
      return result;
    } catch (error) {
      console.error('Database queryFirst error:', error);
      throw error;
    }
  }

  /**
   * 执行更新操作
   */
  async execute(sql, params = []) {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      return result;
    } catch (error) {
      console.error('Database execute error:', error);
      throw error;
    }
  }

  /**
   * 批量执行操作
   */
  async batch(statements) {
    try {
      const prepared = statements.map(stmt => 
        this.db.prepare(stmt.sql).bind(...(stmt.params || []))
      );
      const result = await this.db.batch(prepared);
      return result;
    } catch (error) {
      console.error('Database batch error:', error);
      throw error;
    }
  }
}

/**
 * 链接相关数据库操作
 */
export class LinkDB extends Database {
  /**
   * 创建链接
   */
  async createLink(linkData) {
    const sql = `
      INSERT INTO links (
        short_key, long_url, title, description, password_hash, max_visits, 
        max_devices, visit_limit_mode, expires_at, access_mode, secure_mode, 
        created_by, custom_headers
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      linkData.shortKey,
      linkData.longUrl,
      linkData.title || '',
      linkData.description || '',
      linkData.passwordHash || null,
      linkData.maxVisits || -1,
      linkData.maxDevices || null,
      linkData.visitLimitMode || 'devices',
      linkData.expiresAt || null,
      linkData.accessMode || 'redirect',
      linkData.secureMode !== false ? 1 : 0,
      linkData.createdBy || 'anonymous',
      JSON.stringify(linkData.customHeaders || {})
    ];

    const result = await this.execute(sql, params);
    
    // 插入风控配置
    if (linkData.riskControl) {
      await this.createRiskControlConfig(result.meta.last_row_id, linkData.riskControl);
    }

    // 插入自定义响应头
    if (linkData.customHeaders) {
      await this.createCustomHeaders(result.meta.last_row_id, linkData.customHeaders);
    }

    // 插入标签
    if (linkData.tags && linkData.tags.length > 0) {
      await this.createLinkTags(result.meta.last_row_id, linkData.tags);
    }

    return result;
  }

  /**
   * 根据短键获取链接
   */
  async getLinkByShortKey(shortKey) {
    try {
      const sql = `SELECT * FROM links WHERE short_key = ? AND is_active = 1`;
      console.log('getLinkByShortKey query:', { sql, shortKey });
      
      const result = await this.queryFirst(sql, [shortKey]);
      console.log('getLinkByShortKey result:', result);
      
      return result;
    } catch (error) {
      console.error('getLinkByShortKey error:', {
        message: error.message,
        stack: error.stack,
        shortKey
      });
      throw error;
    }
  }

  /**
   * 获取所有链接
   */
  async getAllLinks(limit = 100, offset = 0, sortBy = 'created_at', sortOrder = 'desc') {
    try {
      // 验证排序字段
      const allowedSortFields = ['created_at', 'short_key', 'long_url', 'title', 'current_visits', 'max_visits', 'is_active'];
      const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';
      
      const sql = `
        SELECT *,
               current_visits as visit_count,
               CASE 
                 WHEN expires_at IS NOT NULL AND expires_at < datetime('now') THEN 1
                 ELSE 0
               END as is_expired,
               CASE 
                 WHEN max_visits > 0 AND current_visits >= max_visits THEN 1
                 ELSE 0
               END as is_limit_reached
        FROM links
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      console.log('Executing getAllLinks query:', { sql, limit, offset, sortBy: validSortBy, sortOrder: validSortOrder });
      const result = await this.query(sql, [limit, offset]);
      console.log('getAllLinks result:', { count: result.length, result });
      return result;
    } catch (error) {
      console.error('getAllLinks database error:', {
        message: error.message,
        stack: error.stack,
        sql: 'SELECT * FROM links ORDER BY ? ? LIMIT ? OFFSET ?',
        limit,
        offset,
        sortBy,
        sortOrder,
        error: error
      });
      throw error;
    }
  }

  /**
   * 搜索链接
   */
  async searchLinks(searchTerm, limit = 100, offset = 0, sortBy = 'created_at', sortOrder = 'desc') {
    try {
      // 验证排序字段
      const allowedSortFields = ['created_at', 'short_key', 'long_url', 'title', 'visit_count'];
      const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
      const validSortOrder = ['asc', 'desc'].includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';
      
      const sql = `
        SELECT *,
               current_visits as visit_count,
               CASE 
                 WHEN expires_at IS NOT NULL AND expires_at < datetime('now') THEN 1
                 ELSE 0
               END as is_expired,
               CASE 
                 WHEN max_visits > 0 AND current_visits >= max_visits THEN 1
                 ELSE 0
               END as is_limit_reached
        FROM links
        WHERE short_key LIKE ? OR long_url LIKE ? OR title LIKE ? OR description LIKE ?
        ORDER BY ${validSortBy} ${validSortOrder}
        LIMIT ? OFFSET ?
      `;
      
      const searchPattern = `%${searchTerm}%`;
      console.log('Executing searchLinks query:', { sql, searchTerm, limit, offset, sortBy: validSortBy, sortOrder: validSortOrder });
      const result = await this.query(sql, [searchPattern, searchPattern, searchPattern, searchPattern, limit, offset]);
      console.log('searchLinks result:', { count: result.length, result });
      return result;
    } catch (error) {
      console.error('searchLinks database error:', {
        message: error.message,
        stack: error.stack,
        searchTerm,
        limit,
        offset,
        sortBy,
        sortOrder,
        error: error
      });
      throw error;
    }
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    try {
      const totalLinks = await this.queryFirst('SELECT COUNT(*) as count FROM links');
      const totalVisits = await this.queryFirst('SELECT COUNT(*) as count FROM access_logs');
      const todayVisits = await this.queryFirst(`
        SELECT COUNT(*) as count FROM access_logs 
        WHERE DATE(visit_timestamp) = DATE('now')
      `);
      
      return {
        totalLinks: totalLinks?.count || 0,
        totalVisits: totalVisits?.count || 0,
        todayVisits: todayVisits?.count || 0
      };
    } catch (error) {
      console.error('getStats database error:', {
        message: error.message,
        stack: error.stack,
        error: error
      });
      throw error;
    }
  }

  /**
   * 更新链接
   */
  async updateLink(linkId, updateData) {
    const fields = [];
    const params = [];

    Object.keys(updateData).forEach(key => {
      if (key !== 'id' && updateData[key] !== undefined) {
        fields.push(`${key} = ?`);
        params.push(updateData[key]);
      }
    });

    if (fields.length === 0) return;

    fields.push('updated_at = ?');
    params.push(getCurrentTimestamp());
    params.push(linkId);

    const sql = `UPDATE links SET ${fields.join(', ')} WHERE id = ?`;
    return await this.execute(sql, params);
  }

  /**
   * 删除链接
   */
  async deleteLink(linkId) {
    const sql = 'DELETE FROM links WHERE id = ?';
    return await this.execute(sql, [linkId]);
  }

  /**
   * 增加访问次数
   */
  async incrementVisits(linkId) {
    const sql = `
      UPDATE links 
      SET current_visits = current_visits + 1,
          total_visits = total_visits + 1,
          last_visit_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    return await this.execute(sql, [linkId]);
  }

  /**
   * 创建风控配置
   */
  async createRiskControlConfig(linkId, riskControl) {
    const sql = `
      INSERT INTO risk_control_configs (link_id, visit_limits, ua_filter, risk_alert, country_restriction)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      linkId,
      JSON.stringify(riskControl.visitLimits || {}),
      JSON.stringify(riskControl.uaFilter || {}),
      JSON.stringify(riskControl.riskAlert || {}),
      JSON.stringify(riskControl.countryRestriction || {})
    ];

    return await this.execute(sql, params);
  }

  /**
   * 创建自定义响应头
   */
  async createCustomHeaders(linkId, customHeaders) {
    const statements = Object.entries(customHeaders).map(([name, value]) => ({
      sql: 'INSERT INTO custom_headers (link_id, header_name, header_value) VALUES (?, ?, ?)',
      params: [linkId, name, value]
    }));

    if (statements.length > 0) {
      return await this.batch(statements);
    }
  }

  /**
   * 创建链接标签
   */
  async createLinkTags(linkId, tags) {
    // 首先确保标签存在
    for (const tagName of tags) {
      await this.createTagIfNotExists(tagName);
    }

    // 获取标签ID
    const tagIds = await Promise.all(
      tags.map(tagName => this.getTagId(tagName))
    );

    // 创建关联
    const statements = tagIds.map(tagId => ({
      sql: 'INSERT OR IGNORE INTO link_tags (link_id, tag_id) VALUES (?, ?)',
      params: [linkId, tagId]
    }));

    if (statements.length > 0) {
      return await this.batch(statements);
    }
  }

  /**
   * 创建标签（如果不存在）
   */
  async createTagIfNotExists(tagName) {
    const sql = 'INSERT OR IGNORE INTO tags (name) VALUES (?)';
    return await this.execute(sql, [tagName]);
  }

  /**
   * 获取标签ID
   */
  async getTagId(tagName) {
    const sql = 'SELECT id FROM tags WHERE name = ?';
    const result = await this.queryFirst(sql, [tagName]);
    return result ? result.id : null;
  }
}

/**
 * 访问记录相关数据库操作
 */
export class AccessLogDB extends Database {
  /**
   * 记录访问
   */
  async logAccess(linkId, accessData) {
    const sql = `
      INSERT INTO access_logs (
        link_id, device_id, ip_address, user_agent, referer, 
        country, city, region, risk_score, is_proxy_tool, 
        proxy_tool_type, browser_detection
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      linkId,
      accessData.deviceId,
      accessData.ipAddress,
      accessData.userAgent || null,
      accessData.referer || null,
      accessData.country || null,
      accessData.city || null,
      accessData.region || null,
      accessData.riskScore || 0,
      accessData.isProxyTool ? 1 : 0,
      accessData.proxyToolType || null,
      JSON.stringify(accessData.browserDetection || {})
    ];

    return await this.execute(sql, params);
  }

  /**
   * 获取链接的访问记录
   */
  async getLinkAccessLogs(linkId, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM access_logs 
      WHERE link_id = ? 
      ORDER BY visit_timestamp DESC 
      LIMIT ? OFFSET ?
    `;
    
    return await this.query(sql, [linkId, limit, offset]);
  }

  /**
   * 获取所有访问记录
   */
  async getAllAccessLogs(limit = 100, offset = 0) {
    const sql = `
      SELECT al.*, l.short_key, l.title
      FROM access_logs al
      JOIN links l ON al.link_id = l.id
      ORDER BY al.visit_timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    return await this.query(sql, [limit, offset]);
  }

  /**
   * 获取访问统计
   */
  async getAccessStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_visits,
        COUNT(DISTINCT device_id) as unique_devices,
        COUNT(DISTINCT ip_address) as unique_ips,
        COUNT(CASE WHEN is_proxy_tool = 1 THEN 1 END) as proxy_visits,
        COUNT(CASE WHEN DATE(visit_timestamp) = DATE('now') THEN 1 END) as today_visits
      FROM access_logs
    `;
    
    return await this.queryFirst(sql);
  }
}

/**
 * 设备相关数据库操作
 */
export class DeviceDB extends Database {
  /**
   * 创建设备记录
   */
  async createDevice(deviceData) {
    const sql = `
      INSERT OR REPLACE INTO devices (device_id, fingerprint_data, last_seen)
      VALUES (?, ?, ?)
    `;
    
    const params = [
      deviceData.deviceId,
      JSON.stringify(deviceData.fingerprintData || {}),
      getCurrentTimestamp()
    ];

    return await this.execute(sql, params);
  }

  /**
   * 获取设备信息
   */
  async getDevice(deviceId) {
    const sql = 'SELECT * FROM devices WHERE device_id = ?';
    return await this.queryFirst(sql, [deviceId]);
  }

  /**
   * 封禁设备
   */
  async blockDevice(deviceId, reason) {
    const sql = `
      UPDATE devices 
      SET is_blocked = 1, block_reason = ?, blocked_at = ?
      WHERE device_id = ?
    `;
    
    return await this.execute(sql, [reason, getCurrentTimestamp(), deviceId]);
  }

  /**
   * 解封设备
   */
  async unblockDevice(deviceId) {
    const sql = `
      UPDATE devices 
      SET is_blocked = 0, block_reason = NULL, blocked_at = NULL
      WHERE device_id = ?
    `;
    
    return await this.execute(sql, [deviceId]);
  }

  /**
   * 获取被封禁的设备
   */
  async getBlockedDevices() {
    const sql = 'SELECT * FROM devices WHERE is_blocked = 1 ORDER BY blocked_at DESC';
    return await this.query(sql);
  }
}

/**
 * IP地址相关数据库操作
 */
export class IPDB extends Database {
  /**
   * 创建IP记录
   */
  async createIP(ipData) {
    const sql = `
      INSERT OR REPLACE INTO ip_addresses (ip_address, country, city, region, last_seen)
      VALUES (?, ?, ?, ?, ?)
    `;
    
    const params = [
      ipData.ipAddress,
      ipData.country || null,
      ipData.city || null,
      ipData.region || null,
      getCurrentTimestamp()
    ];

    return await this.execute(sql, params);
  }

  /**
   * 获取IP信息
   */
  async getIP(ipAddress) {
    const sql = 'SELECT * FROM ip_addresses WHERE ip_address = ?';
    return await this.queryFirst(sql, [ipAddress]);
  }

  /**
   * 封禁IP
   */
  async blockIP(ipAddress, reason) {
    const sql = `
      UPDATE ip_addresses 
      SET is_blocked = 1, block_reason = ?, blocked_at = ?
      WHERE ip_address = ?
    `;
    
    return await this.execute(sql, [reason, getCurrentTimestamp(), ipAddress]);
  }

  /**
   * 解封IP
   */
  async unblockIP(ipAddress) {
    const sql = `
      UPDATE ip_addresses 
      SET is_blocked = 0, block_reason = NULL, blocked_at = NULL
      WHERE ip_address = ?
    `;
    
    return await this.execute(sql, [ipAddress]);
  }

  /**
   * 获取被封禁的IP
   */
  async getBlockedIPs() {
    const sql = 'SELECT * FROM ip_addresses WHERE is_blocked = 1 ORDER BY blocked_at DESC';
    return await this.query(sql);
  }
}

/**
 * 链接设备关联相关数据库操作
 */
export class LinkDeviceDB extends Database {
  /**
   * 添加设备到链接
   */
  async addDeviceToLink(linkId, deviceId) {
    const sql = `
      INSERT OR REPLACE INTO link_devices (link_id, device_id, last_access, access_count)
      VALUES (?, ?, ?, COALESCE((SELECT access_count FROM link_devices WHERE link_id = ? AND device_id = ?), 0) + 1)
    `;
    
    return await this.execute(sql, [linkId, deviceId, getCurrentTimestamp(), linkId, deviceId]);
  }

  /**
   * 获取链接的设备数量
   */
  async getLinkDeviceCount(linkId) {
    const sql = 'SELECT COUNT(*) as count FROM link_devices WHERE link_id = ?';
    const result = await this.queryFirst(sql, [linkId]);
    return result ? result.count : 0;
  }

  /**
   * 检查设备是否在链接中
   */
  async isDeviceInLink(linkId, deviceId) {
    const sql = 'SELECT 1 FROM link_devices WHERE link_id = ? AND device_id = ? LIMIT 1';
    const result = await this.queryFirst(sql, [linkId, deviceId]);
    return !!result;
  }

  /**
   * 获取链接的设备列表
   */
  async getLinkDevices(linkId) {
    const sql = `
      SELECT ld.*, d.fingerprint_data, d.is_blocked, d.block_reason
      FROM link_devices ld
      LEFT JOIN devices d ON ld.device_id = d.device_id
      WHERE ld.link_id = ?
      ORDER BY ld.last_access DESC
    `;
    
    return await this.query(sql, [linkId]);
  }
}
