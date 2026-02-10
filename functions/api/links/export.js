// 链接导出API - 支持大数据量导出
import { 
  successResponse, 
  errorResponse, 
  optionsResponse 
} from '../../utils/response.js';
import { authMiddleware } from '../../utils/auth.js';
import { LinkDB } from '../../utils/database.js';

export async function onRequest(context) {
  const { request, env } = context;
  const db = env.DB;

  try {
    // 处理OPTIONS预检请求
    if (request.method === 'OPTIONS') {
      return optionsResponse();
    }

    // 检查认证
    const auth = await authMiddleware(request, env, db);
    if (!auth || !auth.isAuthenticated) {
      return errorResponse('Unauthorized', 401);
    }

    if (request.method === 'GET') {
      return await exportLinks(request, db);
    } else {
      return errorResponse('Method not allowed', 405);
    }
  } catch (error) {
    console.error('Export API error:', error);
    return errorResponse(`Internal server error: ${error.message}`, 500);
  }
}

/**
 * 导出链接数据
 */
async function exportLinks(request, db) {
  const linkDB = new LinkDB(db);
  
  try {
    const url = new URL(request.url);
    const format = url.searchParams.get('format') || 'csv';
    const pageSize = parseInt(url.searchParams.get('pageSize')) || 1000;
    const search = url.searchParams.get('search') || '';
    
    // 验证导出格式
    if (!['csv', 'json'].includes(format)) {
      return errorResponse('Invalid format. Supported formats: csv, json', 400);
    }

    // 验证页面大小
    if (pageSize < 100 || pageSize > 10000) {
      return errorResponse('Page size must be between 100 and 10000', 400);
    }

    console.log(`Starting export: format=${format}, pageSize=${pageSize}, search=${search}`);

    // 获取总记录数
    const stats = await linkDB.getStats();
    let totalRecords = stats.totalLinks;
    
    // 如果有搜索条件，获取搜索结果总数
    if (search) {
      const searchResults = await linkDB.searchLinks(search, 1, 0);
      totalRecords = searchResults.length;
    }

    if (totalRecords === 0) {
      return errorResponse('No links found to export', 404);
    }

    console.log(`Total records to export: ${totalRecords}`);

    // 设置响应头
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    const filename = `links_export_${timestamp}.${format}`;
    
    const headers = {
      'Content-Type': format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type'
    };

    // 流式导出处理
    if (format === 'csv') {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              await streamCSVExport(controller, linkDB, totalRecords, pageSize, search);
              controller.close();
            } catch (error) {
              console.error('CSV export stream error:', error);
              controller.error(error);
            }
          }
        }),
        { headers }
      );
    } else {
      return new Response(
        new ReadableStream({
          async start(controller) {
            try {
              await streamJSONExport(controller, linkDB, totalRecords, pageSize, search);
              controller.close();
            } catch (error) {
              console.error('JSON export stream error:', error);
              controller.error(error);
            }
          }
        }),
        { headers }
      );
    }

  } catch (error) {
    console.error('Export links error:', error);
    return errorResponse(`Export failed: ${error.message}`, 500);
  }
}

/**
 * 流式CSV导出
 */
async function streamCSVExport(controller, linkDB, totalRecords, pageSize, search) {
  // CSV头部
  const csvHeaders = [
    'ID',
    '短链接',
    '长链接',
    '标题',
    '描述',
    '访问次数',
    '最大访问次数',
    '设备限制',
    '访问模式',
    '创建时间',
    '过期时间',
    '创建者',
    '是否激活',
    '标签'
  ];
  
  controller.enqueue(new TextEncoder().encode(csvHeaders.join(',') + '\n'));

  let offset = 0;
  let exportedCount = 0;

  while (offset < totalRecords) {
    console.log(`Exporting progress: ${exportedCount}/${totalRecords}`);
    
    let links;
    if (search) {
      links = await linkDB.searchLinks(search, pageSize, offset);
    } else {
      links = await linkDB.getAllLinks(pageSize, offset);
    }

    if (!links || links.length === 0) {
      break;
    }

    // 转换为CSV行
    const csvRows = links.map(link => {
      const row = [
        link.id || '',
        escapeCsvField(link.short_key || ''),
        escapeCsvField(link.long_url || ''),
        escapeCsvField(link.title || ''),
        escapeCsvField(link.description || ''),
        link.visit_count || 0,
        link.max_visits || -1,
        link.max_devices || '无限制',
        link.access_mode || 'redirect',
        link.created_at || '',
        link.expires_at || '永不过期',
        link.created_by || 'anonymous',
        link.is_active !== false ? '是' : '否',
        escapeCsvField((link.tags || []).join('; '))
      ];
      return row.join(',');
    });

    // 批量写入数据
    const chunk = csvRows.join('\n') + '\n';
    controller.enqueue(new TextEncoder().encode(chunk));

    exportedCount += links.length;
    offset += pageSize;

    // 避免阻塞事件循环
    if (exportedCount % (pageSize * 5) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  console.log(`CSV export completed: ${exportedCount} records exported`);
}

/**
 * 流式JSON导出
 */
async function streamJSONExport(controller, linkDB, totalRecords, pageSize, search) {
  // JSON开始
  controller.enqueue(new TextEncoder().encode('{\n'));
  controller.enqueue(new TextEncoder().encode('  "exportInfo": {\n'));
  controller.enqueue(new TextEncoder().encode(`    "totalRecords": ${totalRecords},\n`));
  controller.enqueue(new TextEncoder().encode(`    "exportTime": "${new Date().toISOString()}",\n`));
  controller.enqueue(new TextEncoder().encode(`    "format": "json"\n`));
  controller.enqueue(new TextEncoder().encode('  },\n'));
  controller.enqueue(new TextEncoder().encode('  "links": [\n'));

  let offset = 0;
  let exportedCount = 0;
  let isFirst = true;

  while (offset < totalRecords) {
    console.log(`Exporting progress: ${exportedCount}/${totalRecords}`);
    
    let links;
    if (search) {
      links = await linkDB.searchLinks(search, pageSize, offset);
    } else {
      links = await linkDB.getAllLinks(pageSize, offset);
    }

    if (!links || links.length === 0) {
      break;
    }

    // 转换为JSON对象并格式化
    for (const link of links) {
      if (!isFirst) {
        controller.enqueue(new TextEncoder().encode(',\n'));
      }
      
      const linkJson = {
        id: link.id,
        shortKey: link.short_key,
        shortUrl: `${new URL(process.env.REQUEST_URL || 'https://example.com').origin}/${link.short_key}`,
        longUrl: link.long_url,
        title: link.title || '',
        description: link.description || '',
        visitCount: link.visit_count || 0,
        maxVisits: link.max_visits || -1,
        maxDevices: link.max_devices || null,
        visitLimitMode: link.visit_limit_mode || 'devices',
        accessMode: link.access_mode || 'redirect',
        createdAt: link.created_at,
        expiresAt: link.expires_at,
        createdBy: link.created_by || 'anonymous',
        isActive: link.is_active !== false,
        tags: link.tags || []
      };

      const jsonString = JSON.stringify(linkJson, null, 6);
      controller.enqueue(new TextEncoder().encode('    ' + jsonString));
      
      isFirst = false;
      exportedCount++;
    }

    offset += pageSize;

    // 避免阻塞事件循环
    if (exportedCount % (pageSize * 2) === 0) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }

  // JSON结束
  controller.enqueue(new TextEncoder().encode('\n  ]\n'));
  controller.enqueue(new TextEncoder().encode('}\n'));

  console.log(`JSON export completed: ${exportedCount} records exported`);
}

/**
 * CSV字段转义
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  
  const str = String(field);
  
  // 如果包含逗号、引号或换行符，需要用引号包围并转义内部引号
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  
  return str;
}
