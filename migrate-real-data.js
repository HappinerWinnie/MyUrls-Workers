// 基于实际KV数据格式的迁移脚本
import { LinkDB, AccessLogDB, DeviceDB, IPDB, LinkDeviceDB } from './functions/utils/database.js';

// 从KV获取所有数据
async function getAllKVData(env) {
  console.log('🔍 开始获取KV数据...');
  
  const kv = env.LINKS;
  const allData = {};
  let totalKeys = 0;
  let validKeys = 0;
  
  try {
    // 获取所有键
    const listResult = await kv.list();
    totalKeys = listResult.keys.length;
    console.log(`📊 找到 ${totalKeys} 个键`);
    
    // 分批处理，避免超时
    const batchSize = 20;
    for (let i = 0; i < listResult.keys.length; i += batchSize) {
      const batch = listResult.keys.slice(i, i + batchSize);
      console.log(`📦 处理批次 ${Math.floor(i/batchSize) + 1}/${Math.ceil(listResult.keys.length/batchSize)} (${batch.length} 个键)`);
      
      for (const keyInfo of batch) {
        try {
          const key = keyInfo.name;
          const value = await kv.get(key);
          
          if (value) {
            allData[key] = value;
            validKeys++;
          }
        } catch (error) {
          console.log(`⚠️  跳过键 ${keyInfo.name}: ${error.message}`);
        }
      }
    }
    
    console.log(`✅ 成功获取 ${validKeys}/${totalKeys} 个有效键值对`);
    return allData;
  } catch (error) {
    console.error('❌ 获取KV数据失败:', error);
    return {};
  }
}

// 迁移短链接数据
async function migrateShortLinks(kvData, linkDB) {
  console.log('🔗 开始迁移短链接数据...');
  let migratedCount = 0;
  let skippedCount = 0;
  
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
      
      // 检查必要字段
      if (!linkData.longUrl) {
        console.log(`⚠️  跳过无效链接 ${key}: 缺少longUrl`);
        skippedCount++;
        continue;
      }
      
      // 转换数据格式 - 基于实际KV数据结构
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
        if (migratedCount % 10 === 0) {
          console.log(`✅ 已迁移 ${migratedCount} 个链接...`);
        }
      }
    } catch (error) {
      console.log(`❌ 迁移链接 ${key} 失败: ${error.message}`);
      skippedCount++;
    }
  }

  console.log(`🔗 短链接迁移完成: ${migratedCount} 个成功, ${skippedCount} 个跳过`);
  return { migratedCount, skippedCount };
}

// 迁移访问记录
async function migrateAccessLogs(kvData, accessLogDB, linkDB) {
  console.log('📊 开始迁移访问记录...');
  let migratedCount = 0;
  let skippedCount = 0;

  for (const [key, value] of Object.entries(kvData)) {
    if (!key.startsWith('access_log:')) continue;

    try {
      const logData = JSON.parse(value);
      
      // 需要根据shortKey找到对应的linkId
      // 从URL中提取shortKey
      let shortKey = '';
      if (logData.url) {
        const urlParts = logData.url.split('/');
        shortKey = urlParts[urlParts.length - 1];
      }
      
      if (!shortKey) {
        skippedCount++;
        continue;
      }
      
      const linkData = await linkDB.getLinkByShortKey(shortKey);
      if (!linkData) {
        skippedCount++;
        continue;
      }

      const accessData = {
        deviceId: logData.deviceId || 'unknown',
        ipAddress: logData.cfInfo?.country ? logData.cfInfo.country : (logData.headers?.['cf-connecting-ip'] || 'unknown'),
        userAgent: logData.userAgent || '',
        referer: logData.referer || null,
        country: logData.cfInfo?.country || null,
        city: logData.cfInfo?.city || null,
        region: logData.cfInfo?.region || null,
        riskScore: logData.riskScore || 0,
        isProxyTool: logData.isProxyTool || false,
        proxyToolType: logData.proxyToolType || null,
        browserDetection: logData.fullDebugInfo || {}
      };

      await accessLogDB.logAccess(linkData.id, accessData);
      migratedCount++;
      
      if (migratedCount % 50 === 0) {
        console.log(`✅ 已迁移 ${migratedCount} 条访问记录...`);
      }
    } catch (error) {
      console.log(`❌ 迁移访问记录 ${key} 失败: ${error.message}`);
      skippedCount++;
    }
  }

  console.log(`📊 访问记录迁移完成: ${migratedCount} 条成功, ${skippedCount} 条跳过`);
  return { migratedCount, skippedCount };
}

// 主迁移函数
export async function migrateKVToD1(env) {
  console.log('🚀 开始从KV迁移数据到D1数据库...');
  
  // 初始化数据库操作类
  const linkDB = new LinkDB(env.DB);
  const accessLogDB = new AccessLogDB(env.DB);
  const deviceDB = new DeviceDB(env.DB);
  const ipDB = new IPDB(env.DB);
  const linkDeviceDB = new LinkDeviceDB(env.DB);

  try {
    // 获取KV数据
    const kvData = await getAllKVData(env);
    
    if (Object.keys(kvData).length === 0) {
      console.log('⚠️  KV中没有找到数据，跳过迁移');
      return { success: true, stats: { links: 0, accessLogs: 0, devices: 0, ips: 0 } };
    }

    // 迁移短链接
    const linkResult = await migrateShortLinks(kvData, linkDB);
    
    // 迁移访问记录
    const logResult = await migrateAccessLogs(kvData, accessLogDB, linkDB);

    console.log('🎉 数据迁移完成！');
    console.log(`📊 迁移统计:`);
    console.log(`   - 短链接: ${linkResult.migratedCount} 个成功, ${linkResult.skippedCount} 个跳过`);
    console.log(`   - 访问记录: ${logResult.migratedCount} 条成功, ${logResult.skippedCount} 条跳过`);

    return {
      success: true,
      stats: {
        links: linkResult.migratedCount,
        accessLogs: logResult.migratedCount,
        devices: 0,
        ips: 0
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
export async function verifyMigration(env) {
  console.log('🔍 验证迁移结果...');
  
  const linkDB = new LinkDB(env.DB);
  const accessLogDB = new AccessLogDB(env.DB);

  try {
    const links = await linkDB.getAllLinks(10);
    const stats = await accessLogDB.getAccessStats();

    console.log('✅ 验证结果:');
    console.log(`   - 链接数量: ${links.length}`);
    console.log(`   - 访问记录数量: ${stats.total_visits || 0}`);

    return {
      success: true,
      stats: {
        links: links.length,
        accessLogs: stats.total_visits || 0
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
