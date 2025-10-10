// Cloudflare Worker for data migration
import { migrateFromKV, verifyMigration } from '../migrate-kv-to-d1.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    if (url.pathname === '/migrate') {
      if (request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
      }

      try {
        console.log('开始数据迁移...');
        const result = await migrateFromKV(env);
        
        return new Response(JSON.stringify(result, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('迁移失败:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    if (url.pathname === '/verify') {
      try {
        console.log('验证迁移结果...');
        const result = await verifyMigration(env);
        
        return new Response(JSON.stringify(result, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        console.error('验证失败:', error);
        return new Response(JSON.stringify({
          success: false,
          error: error.message
        }, null, 2), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Migration worker - use /migrate or /verify endpoints', { status: 404 });
  }
};
