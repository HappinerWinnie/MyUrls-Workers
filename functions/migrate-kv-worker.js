// Cloudflare Worker for KV to D1 migration
import { migrateKVToD1, verifyMigration } from '../migrate-kv-data.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/migrate') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        console.log('开始KV到D1数据迁移...');
        const result = await migrateKVToD1(env);
        
        return new Response(JSON.stringify(result, null, 2), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        console.error('迁移失败:', error);
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
    
    if (url.pathname === '/verify') {
      try {
        console.log('验证迁移结果...');
        const result = await verifyMigration(env);
        
        return new Response(JSON.stringify(result, null, 2), {
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (error) {
        console.error('验证失败:', error);
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
        const linkDB = new (await import('../functions/utils/database.js')).LinkDB(env.DB);
        const links = await linkDB.getAllLinks(1);
        const d1Count = links.length;
        
        return new Response(JSON.stringify({
          kv: { count: kvCount },
          d1: { count: d1Count },
          migrationNeeded: kvCount > 0 && d1Count === 0
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
        <li><code>GET /verify</code> - 验证迁移结果</li>
        <li><code>GET /status</code> - 检查数据状态</li>
      </ul>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  }
};
