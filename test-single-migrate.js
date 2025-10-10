// 测试单个链接迁移
export default {
  async fetch(request, env, ctx) {
    try {
      console.log('🧪 开始测试单个链接迁移...');
      
      // 获取一个测试链接
      const testKey = 'Q9Jxiy';
      const linkData = await env.LINKS.get(testKey);
      
      if (!linkData) {
        return new Response(JSON.stringify({ error: 'Test key not found' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      const data = JSON.parse(linkData);
      console.log('测试数据:', JSON.stringify(data, null, 2));
      
      // 尝试插入到D1
      const result = await env.DB.prepare(`
        INSERT INTO links (
          short_key, long_url, title, description, password_hash, max_visits, 
          current_visits, total_visits, expires_at, access_mode, secure_mode, 
          is_active, created_at, updated_at, created_by, custom_headers
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        testKey,
        data.longUrl || '',
        data.title || '',
        data.description || '',
        data.password || null,
        data.maxVisits || -1,
        data.currentVisits || 0,
        data.totalVisits || 0,
        data.expiresAt || null,
        data.accessMode || 'redirect',
        data.secureMode !== false ? 1 : 0,
        data.isActive !== false ? 1 : 0,
        data.createdAt || new Date().toISOString(),
        data.updatedAt || new Date().toISOString(),
        data.createdBy || 'migrated',
        JSON.stringify(data.customHeaders || {})
      ).run();
      
      console.log('插入结果:', result);
      
      // 验证插入
      const verify = await env.DB.prepare('SELECT * FROM links WHERE short_key = ?').bind(testKey).first();
      console.log('验证结果:', verify);
      
      return new Response(JSON.stringify({
        success: true,
        result: result,
        verify: verify
      }, null, 2), {
        headers: { 'Content-Type': 'application/json' }
      });
      
    } catch (error) {
      console.error('测试失败:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
