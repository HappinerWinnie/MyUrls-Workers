// 检查迁移状态的脚本
// 使用方法: node check-migration-status.js

console.log('🔍 检查迁移状态...\n');

// 检查D1数据库状态
async function checkD1Status() {
  console.log('📊 D1数据库状态:');
  
  try {
    // 这里需要您手动运行wrangler命令来检查
    console.log('请运行以下命令检查D1数据库状态:');
    console.log('wrangler d1 execute myurls-db --command="SELECT COUNT(*) as links FROM links;" --remote');
    console.log('wrangler d1 execute myurls-db --command="SELECT COUNT(*) as access_logs FROM access_logs;" --remote');
    console.log('wrangler d1 execute myurls-db --command="SELECT COUNT(*) as devices FROM devices;" --remote');
    console.log('wrangler d1 execute myurls-db --command="SELECT COUNT(*) as ips FROM ip_addresses;" --remote');
  } catch (error) {
    console.error('❌ 检查D1状态失败:', error.message);
  }
}

// 检查KV存储状态
async function checkKVStatus() {
  console.log('\n📦 KV存储状态:');
  
  try {
    console.log('请运行以下命令检查KV存储状态:');
    console.log('wrangler kv key list --namespace-id=your-kv-namespace-id');
    console.log('或者通过Cloudflare控制台查看KV存储内容');
  } catch (error) {
    console.error('❌ 检查KV状态失败:', error.message);
  }
}

// 提供迁移建议
function provideMigrationAdvice() {
  console.log('\n💡 迁移建议:');
  console.log('1. 如果KV中有重要数据，建议先备份');
  console.log('2. 使用提供的迁移脚本进行数据迁移');
  console.log('3. 迁移后验证数据完整性');
  console.log('4. 测试所有功能是否正常');
  console.log('5. 更新生产环境配置');
}

// 主函数
async function main() {
  console.log('🚀 MyUrls 数据迁移状态检查\n');
  
  await checkD1Status();
  await checkKVStatus();
  provideMigrationAdvice();
  
  console.log('\n📋 下一步操作:');
  console.log('1. 检查当前数据状态');
  console.log('2. 运行迁移脚本: node migrate-kv-to-d1.js');
  console.log('3. 验证迁移结果');
  console.log('4. 部署到生产环境');
}

// 运行检查
main().catch(console.error);
