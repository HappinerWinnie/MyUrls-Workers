// 从KV迁移到D1数据库的脚本
import { LinkDB, AccessLogDB, DeviceDB, IPDB, LinkDeviceDB } from './functions/utils/database.js';

/**
 * 迁移KV数据到D1数据库
 */
export async function migrateFromKV(kv, db) {
  console.log('开始迁移数据从KV到D1数据库...');
  
  const linkDB = new LinkDB(db);
  const accessLogDB = new AccessLogDB(db);
  const deviceDB = new DeviceDB(db);
  const ipDB = new IPDB(db);
  const linkDeviceDB = new LinkDeviceDB(db);

  try {
    // 1. 迁移链接数据
    console.log('迁移链接数据...');
    const linkKeys = await kv.list({ prefix: '' });
    let migratedLinks = 0;
    
    for (const keyInfo of linkKeys.keys) {
      const key = keyInfo.name;
      
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
        const linkDataStr = await kv.get(key);
        if (!linkDataStr) continue;

        const linkData = JSON.parse(linkDataStr);
        
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
          createdBy: linkData.createdBy || 'anonymous',
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
          migratedLinks++;
          console.log(`迁移链接: ${key} -> ID: ${result.meta.last_row_id}`);
        }
      } catch (error) {
        console.error(`迁移链接 ${key} 失败:`, error);
      }
    }

    console.log(`链接迁移完成: ${migratedLinks} 个链接`);

    // 2. 迁移访问记录
    console.log('迁移访问记录...');
    const accessLogKeys = await kv.list({ prefix: 'access_log:' });
    let migratedLogs = 0;

    for (const keyInfo of accessLogKeys.keys) {
      try {
        const logDataStr = await kv.get(keyInfo.name);
        if (!logDataStr) continue;

        const logData = JSON.parse(logDataStr);
        
        // 需要根据shortKey找到对应的linkId
        const linkData = await linkDB.getLinkByShortKey(logData.shortKey || '');
        if (!linkData) continue;

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
        migratedLogs++;
      } catch (error) {
        console.error(`迁移访问记录 ${keyInfo.name} 失败:`, error);
      }
    }

    console.log(`访问记录迁移完成: ${migratedLogs} 条记录`);

    // 3. 迁移设备数据
    console.log('迁移设备数据...');
    const deviceKeys = await kv.list({ prefix: 'device:' });
    let migratedDevices = 0;

    for (const keyInfo of deviceKeys.keys) {
      try {
        const deviceDataStr = await kv.get(keyInfo.name);
        if (!deviceDataStr) continue;

        const deviceData = JSON.parse(deviceDataStr);
        
        await deviceDB.createDevice({
          deviceId: deviceData.deviceId || keyInfo.name.replace('device:', ''),
          fingerprintData: deviceData.fingerprint || {},
          isBlocked: deviceData.isBlocked || false,
          blockReason: deviceData.blockReason || null
        });
        
        migratedDevices++;
      } catch (error) {
        console.error(`迁移设备 ${keyInfo.name} 失败:`, error);
      }
    }

    console.log(`设备数据迁移完成: ${migratedDevices} 个设备`);

    // 4. 迁移IP数据
    console.log('迁移IP数据...');
    const ipKeys = await kv.list({ prefix: 'ip:' });
    let migratedIPs = 0;

    for (const keyInfo of ipKeys.keys) {
      try {
        const ipDataStr = await kv.get(keyInfo.name);
        if (!ipDataStr) continue;

        const ipData = JSON.parse(ipDataStr);
        
        await ipDB.createIP({
          ipAddress: ipData.ipAddress || keyInfo.name.replace('ip:', ''),
          country: ipData.country || null,
          city: ipData.city || null,
          region: ipData.region || null,
          isBlocked: ipData.isBlocked || false,
          blockReason: ipData.blockReason || null
        });
        
        migratedIPs++;
      } catch (error) {
        console.error(`迁移IP ${keyInfo.name} 失败:`, error);
      }
    }

    console.log(`IP数据迁移完成: ${migratedIPs} 个IP`);

    console.log('数据迁移完成！');
    return {
      success: true,
      stats: {
        links: migratedLinks,
        accessLogs: migratedLogs,
        devices: migratedDevices,
        ips: migratedIPs
      }
    };

  } catch (error) {
    console.error('迁移过程中发生错误:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 验证迁移结果
 */
export async function verifyMigration(db) {
  console.log('验证迁移结果...');
  
  const linkDB = new LinkDB(db);
  const accessLogDB = new AccessLogDB(db);
  const deviceDB = new DeviceDB(db);
  const ipDB = new IPDB(db);

  try {
    const links = await linkDB.getAllLinks(10);
    const accessLogs = await accessLogDB.getAllAccessLogs(10);
    const devices = await deviceDB.getBlockedDevices();
    const ips = await ipDB.getBlockedIPs();
    const stats = await accessLogDB.getAccessStats();

    console.log('验证结果:');
    console.log(`- 链接数量: ${links.length}`);
    console.log(`- 访问记录数量: ${stats.total_visits || 0}`);
    console.log(`- 设备数量: ${devices.length}`);
    console.log(`- IP数量: ${ips.length}`);

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
    console.error('验证失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}
