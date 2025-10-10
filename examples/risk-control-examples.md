# 风控功能使用示例

## 1. 订阅链接保护

### 场景描述
保护Clash订阅链接，只允许代理工具访问，防止浏览器直接访问导致订阅泄露。

### 配置示例
```javascript
{
  "longUrl": "https://example.com/clash-config.yaml",
  "shortKey": "my-clash-sub",
  "title": "Clash订阅链接",
  "visitLimits": {
    "perDevice": 3,        // 每设备最多3次
    "perIP": 10            // 每IP最多10次
  },
  "uaFilter": {
    "blockBrowsers": true, // 屏蔽浏览器访问
    "allowedPatterns": [   // 只允许这些UA
      "clash",
      "v2ray",
      "quantumult",
      "surge"
    ]
  },
  "riskAlert": {
    "enabled": true,
    "telegramToken": "YOUR_BOT_TOKEN",
    "telegramChatId": "YOUR_CHAT_ID",
    "alertThreshold": 70
  }
}
```

### 效果
- 浏览器访问会被拒绝
- 只有Clash等代理工具可以访问
- 每设备最多访问3次，防止滥用
- 异常访问会发送Telegram告警

## 2. 临时分享链接

### 场景描述
创建临时分享链接，限制访问次数和有效期，适合一次性分享。

### 配置示例
```javascript
{
  "longUrl": "https://example.com/private-file.pdf",
  "shortKey": "temp-share-123",
  "title": "临时文件分享",
  "visitLimits": {
    "total": 50,           // 总共只能访问50次
    "perDevice": 2,        // 每设备最多2次
    "perIP": 5             // 每IP最多5次
  },
  "expiryDays": 7,         // 7天后过期
  "password": "temp123"    // 需要密码访问
}
```

### 效果
- 需要密码才能访问
- 总共只能访问50次
- 7天后自动过期
- 防止单设备或IP过度访问

## 3. 高安全级别链接

### 场景描述
保护敏感内容，使用最严格的风控策略。

### 配置示例
```javascript
{
  "longUrl": "https://example.com/sensitive-doc",
  "shortKey": "secure-doc",
  "title": "机密文档",
  "visitLimits": {
    "perDevice": 1,        // 每设备只能访问1次
    "perDeviceIP": 1       // 同设备+IP组合只能1次
  },
  "uaFilter": {
    "blockBrowsers": true,
    "allowedPatterns": ["specific-app-v1.0"] // 只允许特定应用
  },
  "riskAlert": {
    "enabled": true,
    "telegramToken": "YOUR_BOT_TOKEN",
    "telegramChatId": "YOUR_CHAT_ID",
    "alertThreshold": 30   // 低阈值告警
  }
}
```

### 效果
- 每设备只能访问1次
- 只允许特定应用访问
- 任何异常都会立即告警
- 访问后立即失效

## 4. 公开分享链接

### 场景描述
创建公开分享链接，允许正常访问但防止滥用。

### 配置示例
```javascript
{
  "longUrl": "https://example.com/public-resource",
  "shortKey": "public-resource",
  "title": "公开资源",
  "visitLimits": {
    "perIP": 100,          // 每IP最多100次
    "perDevice": 20        // 每设备最多20次
  },
  "uaFilter": {
    "blockedPatterns": [   // 禁止爬虫和机器人
      "bot",
      "spider",
      "crawler",
      "scraper"
    ]
  }
}
```

### 效果
- 允许正常用户访问
- 防止爬虫和机器人
- 限制单IP和设备的访问频率
- 不设置过严的限制

## 5. 测试和调试

### 使用测试页面
1. 打开 `test-risk-control.html`
2. 配置测试参数
3. 创建测试链接
4. 测试不同UA和访问模式
5. 查看访问统计和风控效果

### 测试用例
```javascript
// 测试浏览器访问被屏蔽
{
  "uaFilter": {
    "blockBrowsers": true
  }
}

// 测试多次访问限制
{
  "visitLimits": {
    "perDevice": 3
  }
}

// 测试特定UA模式
{
  "uaFilter": {
    "allowedPatterns": ["clash", "v2ray"]
  }
}
```

## 6. 管理后台操作

### 查看访问统计
1. 登录管理后台
2. 点击"风控管理"
3. 查看访问记录和风险评分
4. 分析异常访问模式

### 封禁管理
1. 在风控管理面板中
2. 输入设备ID或IP地址
3. 设置封禁原因和时长
4. 执行封禁操作

### 解封操作
1. 在封禁列表中查看被封禁的设备/IP
2. 点击"解封"按钮
3. 确认解封操作

## 7. 最佳实践

### 订阅链接保护
- 启用浏览器屏蔽
- 设置合理的访问限制
- 配置Telegram告警
- 定期检查访问统计

### 临时分享
- 设置短期有效期
- 限制总访问次数
- 使用密码保护
- 监控异常访问

### 高安全内容
- 使用最严格限制
- 只允许特定应用
- 设置低阈值告警
- 及时处理异常

### 公开资源
- 适度限制访问频率
- 屏蔽爬虫和机器人
- 监控访问模式
- 根据情况调整策略

## 8. 注意事项

### 设备指纹稳定性
- 设备指纹可能因浏览器更新而变化
- 建议结合IP限制使用
- 定期清理过期的访问记录

### 误封风险
- 严格限制可能导致正常用户被误封
- 建议设置合理的限制阈值
- 提供解封机制

### 性能考虑
- 大量访问记录可能影响性能
- 建议定期清理历史数据
- 使用TTL自动过期机制

### 隐私保护
- 访问日志包含敏感信息
- 需要妥善保护用户隐私
- 遵守相关法律法规
