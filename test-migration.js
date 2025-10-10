// 测试迁移脚本
import { migrateKVToD1, verifyMigration } from './migrate-real-data.js';

// 模拟环境对象
const mockEnv = {
  LINKS: {
    async list() {
      // 模拟KV list操作
      return {
        keys: [
          { name: 'Q9Jxiy' },
          { name: 'a' },
          { name: 'access_log:access_log_1760077046189_2p1sy15r6' }
        ]
      };
    },
    async get(key) {
      // 模拟KV get操作
      const mockData = {
        'Q9Jxiy': JSON.stringify({
          id: "3ab75e5e-5bc4-4349-a37a-e7bba3e2013e",
          longUrl: "https://fk.91ssvip.me/FangKong00000000000000000000000000002",
          shortKey: "Q9Jxiy",
          title: "",
          description: "",
          password: null,
          maxVisits: 4,
          currentVisits: 4,
          expiresAt: "2025-10-16T11:26:29.380Z",
          accessMode: "proxy",
          secureMode: true,
          customHeaders: {"subscription-userinfo": "upload=0; download=0; total=1610612736000; expire=1791504000"},
          createdAt: "2025-10-09T11:26:29.380Z",
          updatedAt: "2025-10-09T11:28:33.103Z",
          createdBy: "anonymous",
          tags: [],
          isActive: true,
          totalVisits: 4,
          lastVisitAt: "2025-10-09T11:28:33.103Z"
        }),
        'a': JSON.stringify({
          id: "91f64ea0-35a3-464e-b7ca-911427a49960",
          longUrl: "https://www.svpn.asia/api/v1/client/subscribe/ff357ccdca8d0be62c6c3c98ec2e9197",
          shortKey: "a",
          title: "a",
          description: "",
          password: "zCaeHZzljWEiTvNz:0988760cecb7fdc9b37802be0f9fb2e0af77b6cb6947043c57361c676891b0d2",
          maxVisits: 100000000000000000,
          currentVisits: 0,
          expiresAt: "2025-08-17T12:28:00.181Z",
          accessMode: "proxy",
          secureMode: true,
          customHeaders: {"content-disposition": "attachment; filename*=UTF-8''qq"},
          createdAt: "2025-08-10T12:28:00.181Z",
          updatedAt: "2025-08-10T12:28:00.181Z",
          createdBy: "anonymous",
          tags: [],
          isActive: true,
          totalVisits: 0
        })
      };
      return mockData[key] || null;
    }
  },
  DB: {
    // 模拟D1数据库
    prepare: (sql) => ({
      bind: (...params) => ({
        all: async () => [],
        first: async () => null,
        run: async () => ({ success: true, meta: { last_row_id: 1 } })
      })
    })
  }
};

async function testMigration() {
  console.log('🧪 开始测试迁移脚本...');
  
  try {
    // 测试迁移
    const result = await migrateKVToD1(mockEnv);
    console.log('迁移结果:', result);
    
    // 测试验证
    const verifyResult = await verifyMigration(mockEnv);
    console.log('验证结果:', verifyResult);
    
  } catch (error) {
    console.error('测试失败:', error);
  }
}

// 运行测试
testMigration();
