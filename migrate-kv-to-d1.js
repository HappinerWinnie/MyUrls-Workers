// KV到D1数据库迁移脚本
// 使用方法: node migrate-kv-to-d1.js

import { LinkDB, AccessLogDB, DeviceDB, IPDB, LinkDeviceDB } from './functions/utils/database.js';

// 模拟KV存储（您需要替换为实际的KV连接）
class MockKV {
  constructor() {
    this.data = new Map();
  }

  async get(key) {
    return this.data.get(key);
  }

  async list(options = {}) {
    const keys = Array.from(this.data.keys());
    const filteredKeys = keys.filter(key => {
      if (options.prefix && !key.startsWith(options.prefix)) {
        return false;
      }
      return true;
    });
    
    return {
      keys: filteredKeys.map(key => ({ name: key }))
    };
  }
}

// 从Cloudflare Workers环境获取KV数据
async function getKVData(env) {
  const kv = env.LINKS;
  const data = {};
  
  try {
    // 获取所有键
    const listResult = await kv.list();
    
    for (const keyInfo of listResult.keys) {
      const key = keyInfo.name;
      const value = await kv.get(key);
      if (value) {
        data[key] = value;
      }
    }
    
    console.log(`从KV获取了 ${Object.keys(data).length} 个键值对`);
    return data;
  } catch (error) {
    console.error('获取KV数据失败:', error);
    return {};
  }
}

// 迁移链接数据
async function migrateLinks(kvData, linkDB) {
  console.log('开始迁移链接数据...');
  let migratedCount = 0;
  
  for (const [key, value] of Object.entries(kvData)) {
    // 跳过非链接数据
    if (key.startsWith('access_log:') || 
        key.startsWith('device:') || 
        key.startsWith('ip:') || 
        key.startsWith('link_devices:') ||
        key.startsWith('access_stats') ||
        key.startsWith('blocked_') ||
        key.startsWith('session:')) {
      continue;
    }

    try {
      const linkData = JSON.parse(value);
      
      // 转换数据格式
      const newLinkData = {
        shortKey: key,
        longUrl: linkData.longUrl,
        title: linkData.title || '',
        description: linkData.description || '',
        passwordHash: linkData.password || null,
        maxVisits: linkData.maxVisits || -1,
        maxDevices: linkData.maxDevices || null,
        visitLimitMode: linkData.visitLimitMode || 'devices',
        expiresAt: linkData.expiresAt || null,
        accessMode: linkData.accessMode || 'redirect',
        secureMode: linkData.secureMode !== false,
        createdBy: linkData.createdBy || 'migrated',
        customHeaders: linkData.customHeaders || {},
        tags: linkData.tags || [],
        riskControl: {
          visitLimits: linkData.visitLimits || {},
          uaFilter: linkData.uaFilter || {},
          riskAlert: linkData.riskAlert || {},
          countryRestriction: linkData.countryRestriction || {}
        }
      };

      // 创建链接
      const result = await linkDB.createLink(newLinkData);
      if (result.success) {
        migratedCount++;
        console.log(`✅ 迁移链接: ${key} -> ID: ${result.meta.last_row_id}`);
      }
    } catch (error) {
      console.error(`❌ 迁移链接 ${key} 失败:`, error.message);
    }
  }

  console.log(`链接迁移完成: ${migratedCount} 个链接`);
  return migratedCount;
}

// 迁移访问记录
async function migrateAccessLogs(kvData, accessLogDB, linkDB) {
  console.log('开始迁移访问记录...');
  let migratedCount = 0;

  for (const [key, value] of Object.entries(kvData)) {
    if (!key.startsWith('access_log:')) continue;

    try {
      const logData = JSON.parse(value);
      
      // 需要根据shortKey找到对应的linkId
      const linkData = await linkDB.getLinkByShortKey(logData.shortKey || '');
      if (!linkData) {
        console.log(`⚠️  找不到链接: ${logData.shortKey}`);
        continue;
      }

      const accessData = {
        deviceId: logData.deviceId || 'unknown',
        ipAddress: logData.ip || 'unknown',
        userAgent: logData.userAgent || '',
        referer: logData.referer || null,
        country: logData.country || null,
        city: logData.city || null,
        region: logData.region || null,
        riskScore: logData.riskScore || 0,
        isProxyTool: logData.isProxyTool || false,
        proxyToolType: logData.proxyToolType || null,
        browserDetection: logData.browserDetection || {}
      };

      await accessLogDB.logAccess(linkData.id, accessData);
      migratedCount++;
    } catch (error) {
      console.error(`❌ 迁移访问记录 ${key} 失败:`, error.message);
    }
  }

  console.log(`访问记录迁移完成: ${migratedCount} 条记录`);
  return migratedCount;
}

// 迁移设备数据
async function migrateDevices(kvData, deviceDB) {
  console.log('开始迁移设备数据...');
  let migratedCount = 0;

  for (const [key, value] of Object.entries(kvData)) {
    if (!key.startsWith('device:')) continue;

    try {
      const deviceData = JSON.parse(value);
      
      await deviceDB.createDevice({
        deviceId: deviceData.deviceId || key.replace('device:', ''),
        fingerprintData: deviceData.fingerprint || {},
        isBlocked: deviceData.isBlocked || false,
        blockReason: deviceData.blockReason || null
      });
      
      migratedCount++;
    } catch (error) {
      console.error(`❌ 迁移设备 ${key} 失败:`, error.message);
    }
  }

  console.log(`设备数据迁移完成: ${migratedCount} 个设备`);
  return migratedCount;
}

// 迁移IP数据
async function migrateIPs(kvData, ipDB) {
  console.log('开始迁移IP数据...');
  let migratedCount = 0;

  for (const [key, value] of Object.entries(kvData)) {
    if (!key.startsWith('ip:')) continue;

    try {
      const ipData = JSON.parse(value);
      
      await ipDB.createIP({
        ipAddress: ipData.ipAddress || key.replace('ip:', ''),
        country: ipData.country || null,
        city: ipData.city || null,
        region: ipData.region || null,
        isBlocked: ipData.isBlocked || false,
        blockReason: ipData.blockReason || null
      });
      
      migratedCount++;
    } catch (error) {
      console.error(`❌ 迁移IP ${key} 失败:`, error.message);
    }
  }

  console.log(`IP数据迁移完成: ${migratedCount} 个IP`);
  return migratedCount;
}

// 主迁移函数
async function migrateFromKV(env) {
  console.log('🚀 开始从KV迁移数据到D1数据库...');
  
  // 初始化数据库操作类
  const linkDB = new LinkDB(env.DB);
  const accessLogDB = new AccessLogDB(env.DB);
  const deviceDB = new DeviceDB(env.DB);
  const ipDB = new IPDB(env.DB);
  const linkDeviceDB = new LinkDeviceDB(env.DB);

  try {
    // 获取KV数据
    const kvData = await getKVData(env);
    
    if (Object.keys(kvData).length === 0) {
      console.log('⚠️  KV中没有找到数据，跳过迁移');
      return;
    }

    // 迁移各种数据
    const linkCount = await migrateLinks(kvData, linkDB);
    const logCount = await migrateAccessLogs(kvData, accessLogDB, linkDB);
    const deviceCount = await migrateDevices(kvData, deviceDB);
    const ipCount = await migrateIPs(kvData, ipDB);

    console.log('🎉 数据迁移完成！');
    console.log(`📊 迁移统计:`);
    console.log(`   - 链接: ${linkCount} 个`);
    console.log(`   - 访问记录: ${logCount} 条`);
    console.log(`   - 设备: ${deviceCount} 个`);
    console.log(`   - IP: ${ipCount} 个`);

    return {
      success: true,
      stats: {
        links: linkCount,
        accessLogs: logCount,
        devices: deviceCount,
        ips: ipCount
      }
    };

  } catch (error) {
    console.error('❌ 迁移过程中发生错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 验证迁移结果
async function verifyMigration(env) {
  console.log('🔍 验证迁移结果...');
  
  const linkDB = new LinkDB(env.DB);
  const accessLogDB = new AccessLogDB(env.DB);
  const deviceDB = new DeviceDB(env.DB);
  const ipDB = new IPDB(env.DB);

  try {
    const links = await linkDB.getAllLinks(10);
    const accessLogs = await accessLogDB.getAllAccessLogs(10);
    const devices = await deviceDB.getBlockedDevices();
    const ips = await ipDB.getBlockedIPs();
    const stats = await accessLogDB.getAccessStats();

    console.log('✅ 验证结果:');
    console.log(`   - 链接数量: ${links.length}`);
    console.log(`   - 访问记录数量: ${stats.total_visits || 0}`);
    console.log(`   - 设备数量: ${devices.length}`);
    console.log(`   - IP数量: ${ips.length}`);

    return {
      success: true,
      stats: {
        links: links.length,
        accessLogs: stats.total_visits || 0,
        devices: devices.length,
        ips: ips.length
      }
    };
  } catch (error) {
    console.error('❌ 验证失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// 导出函数供Cloudflare Workers使用
export { migrateFromKV, verifyMigration };

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('请通过Cloudflare Workers环境运行此迁移脚本');
  console.log('或者使用: wrangler d1 execute myurls-db --command="SELECT COUNT(*) FROM links;" --remote');
}
