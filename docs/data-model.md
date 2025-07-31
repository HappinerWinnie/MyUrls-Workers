# 短链接服务数据模型设计

## KV 存储结构

### 1. 短链接数据 (Key: shortKey)
```json
{
  "id": "abc123",
  "longUrl": "https://example.com/very/long/url",
  "shortKey": "abc123",
  "title": "示例网站",
  "description": "这是一个示例网站",
  "
  
  // 访问控制
  "password": "encrypted_password_hash", // 可选，密码保护
  "maxVisits": 100, // 最大访问次数限制，-1表示无限制
  "currentVisits": 0, // 当前访问次数
  "expiresAt": "2024-12-31T23:59:59Z", // 过期时间，null表示永不过期
  
  // 访问模式
  "accessMode": "redirect", // redirect|proxy|password|warning
  
  // 元数据
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-01T00:00:00Z",
  "createdBy": "admin", // 创建者
  "tags": ["work", "important"], // 标签
  "isActive": true, // 是否激活
  
  // 统计信息
  "totalVisits": 0,
  "lastVisitAt": null,
  "visitHistory": [] // 最近访问记录
}
```

### 2. 访问统计数据 (Key: stats:{shortKey}:{date})
```json
{
  "shortKey": "abc123",
  "date": "2024-01-01",
  "visits": 10,
  "uniqueVisitors": 8,
  "referrers": {
    "direct": 5,
    "google.com": 3,
    "twitter.com": 2
  },
  "countries": {
    "CN": 6,
    "US": 3,
    "JP": 1
  },
  "devices": {
    "desktop": 7,
    "mobile": 3
  }
}
```

### 3. 用户会话 (Key: session:{sessionId})
```json
{
  "sessionId": "session_uuid",
  "userId": "admin",
  "createdAt": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-01-01T24:00:00Z",
  "isValid": true
}
```

### 4. 系统配置 (Key: config:system)
```json
{
  "siteName": "MyUrls",
  "siteDescription": "简单易用的短链接服务",
  "adminPassword": "hashed_password",
  "defaultMaxVisits": -1,
  "defaultExpiryDays": 365,
  "allowCustomAlias": true,
  "requireAuth": true
}
```

## API 端点设计

### 认证相关
- `POST /api/auth/login` - 管理员登录
- `POST /api/auth/logout` - 登出
- `GET /api/auth/check` - 检查登录状态

### 短链接管理
- `POST /api/links` - 创建短链接
- `GET /api/links` - 获取链接列表（分页、搜索）
- `GET /api/links/{shortKey}` - 获取单个链接详情
- `PUT /api/links/{shortKey}` - 更新链接
- `DELETE /api/links/{shortKey}` - 删除链接
- `POST /api/links/batch` - 批量操作

### 访问统计
- `GET /api/stats/{shortKey}` - 获取链接统计
- `GET /api/stats/overview` - 获取总体统计

### 短链接访问
- `GET /{shortKey}` - 访问短链接（重定向）
- `POST /{shortKey}/verify` - 密码验证

## 功能特性

### 访问次数限制（核心功能）
- 每次访问时检查 `currentVisits < maxVisits`
- 达到限制后返回 403 或自定义页面
- 支持无限制访问（maxVisits = -1）

### 密码保护
- 支持为链接设置访问密码
- 密码使用安全哈希存储
- 验证通过后设置临时访问令牌

### 过期控制
- 支持设置链接过期时间
- 过期后自动失效
- 支持永不过期设置

### 访问统计
- 实时统计访问次数
- 记录访问来源、设备、地理位置
- 支持 Analytics Engine 集成

### 多种访问模式
- `redirect`: 直接重定向（默认）
- `proxy`: 代理访问
- `password`: 需要密码验证
- `warning`: 显示警告页面后跳转
