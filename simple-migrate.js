// 简化的迁移脚本 - 直接在Cloudflare Workers中运行
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/migrate') {
      try {
        console.log('🚀 开始KV到D1数据迁移...');
        
        // 获取KV数据
        const kvList = await env.LINKS.list();
        console.log(`📊 找到 ${kvList.keys.length} 个键`);
        
        let migratedLinks = 0;
        let migratedLogs = 0;
        
        // 分批处理链接
        const linkKeys = kvList.keys.filter(key => 
          !key.name.startsWith('access_log:') && 
          !key.name.startsWith('device:') && 
          !key.name.startsWith('ip:') && 
          !key.name.startsWith('link_devices:') &&
          !key.name.startsWith('access_stats') &&
          !key.name.startsWith('blocked_') &&
          !key.name.startsWith('session:')
        );
        
        console.log(`🔗 开始迁移 ${linkKeys.length} 个短链接...`);
        
        for (const keyInfo of linkKeys) {
          try {
            const key = keyInfo.name;
            const value = await env.LINKS.get(key);
            
            if (!value) continue;
            
            const linkData = JSON.parse(value);
            
            // 插入到D1数据库
            const result = await env.DB.prepare(`
              INSERT INTO links (
                short_key, long_url, title, description, password_hash, max_visits, 
                max_devices, visit_limit_mode, current_visits, total_visits, expires_at, 
                access_mode, secure_mode, is_active, created_at, updated_at, 
                last_visit_at, created_by, custom_headers
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              key,
              linkData.longUrl || '',
              linkData.title || '',
              linkData.description || '',
              linkData.password || null,
              linkData.maxVisits || -1,
              linkData.maxDevices || null,
              linkData.visitLimitMode || 'devices',
              linkData.currentVisits || 0,
              linkData.totalVisits || 0,
              linkData.expiresAt || null,
              linkData.accessMode || 'redirect',
              linkData.secureMode !== false ? 1 : 0,
              linkData.isActive !== false ? 1 : 0,
              linkData.createdAt || new Date().toISOString(),
              linkData.updatedAt || new Date().toISOString(),
              linkData.lastVisitAt || null,
              linkData.createdBy || 'migrated',
              JSON.stringify(linkData.customHeaders || {})
            ).run();
            
            if (result.success) {
              migratedLinks++;
              if (migratedLinks % 10 === 0) {
                console.log(`✅ 已迁移 ${migratedLinks} 个链接...`);
              }
            }
          } catch (error) {
            console.log(`❌ 迁移链接 ${keyInfo.name} 失败: ${error.message}`);
          }
        }
        
        // 处理访问记录
        const logKeys = kvList.keys.filter(key => key.name.startsWith('access_log:'));
        console.log(`📊 开始迁移 ${logKeys.length} 条访问记录...`);
        
        for (const keyInfo of logKeys) {
          try {
            const key = keyInfo.name;
            const value = await env.LINKS.get(key);
            
            if (!value) continue;
            
            const logData = JSON.parse(value);
            
            // 从URL中提取shortKey
            let shortKey = '';
            if (logData.url) {
              const urlParts = logData.url.split('/');
              shortKey = urlParts[urlParts.length - 1];
            }
            
            if (!shortKey) continue;
            
            // 查找对应的链接ID
            const linkResult = await env.DB.prepare('SELECT id FROM links WHERE short_key = ?').bind(shortKey).first();
            if (!linkResult) continue;
            
            // 插入访问记录
            await env.DB.prepare(`
              INSERT INTO access_logs (
                link_id, device_id, ip_address, user_agent, referer, 
                country, city, region, risk_score, is_proxy_tool, 
                proxy_tool_type, browser_detection, visit_timestamp
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
              linkResult.id,
              logData.deviceId || 'unknown',
              logData.cfInfo?.country || logData.headers?.['cf-connecting-ip'] || 'unknown',
              logData.userAgent || '',
              logData.referer || null,
              logData.cfInfo?.country || null,
              logData.cfInfo?.city || null,
              logData.cfInfo?.region || null,
              logData.riskScore || 0,
              logData.isProxyTool ? 1 : 0,
              logData.proxyToolType || null,
              JSON.stringify(logData.fullDebugInfo || {}),
              logData.timestamp || new Date().toISOString()
            ).run();
            
            migratedLogs++;
            if (migratedLogs % 50 === 0) {
              console.log(`✅ 已迁移 ${migratedLogs} 条访问记录...`);
            }
          } catch (error) {
            console.log(`❌ 迁移访问记录 ${keyInfo.name} 失败: ${error.message}`);
          }
        }
        
        console.log('🎉 数据迁移完成！');
        
        return new Response(JSON.stringify({
          success: true,
          message: '数据迁移完成',
          stats: {
            links: migratedLinks,
            accessLogs: migratedLogs
          }
        }, null, 2), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
        
      } catch (error) {
        console.error('❌ 迁移失败:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    if (url.pathname === '/status') {
      try {
        // 检查KV数据量
        const kvList = await env.LINKS.list();
        const kvCount = kvList.keys.length;
        
        // 检查D1数据量
        const linkCount = await env.DB.prepare('SELECT COUNT(*) as count FROM links').first();
        const logCount = await env.DB.prepare('SELECT COUNT(*) as count FROM access_logs').first();
        
        return new Response(JSON.stringify({
          kv: { count: kvCount },
          d1: { 
            links: linkCount?.count || 0,
            logs: logCount?.count || 0
          },
          migrationNeeded: kvCount > 0 && (linkCount?.count || 0) === 0
        }, null, 2), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        return new Response(JSON.stringify({
          error: error.message
        }, null, 2), {
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    return new Response(`
      <h1>KV到D1数据迁移工具</h1>
      <p>可用的端点:</p>
      <ul>
        <li><code>POST /migrate</code> - 开始迁移</li>
        <li><code>GET /status</code> - 检查数据状态</li>
      </ul>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
