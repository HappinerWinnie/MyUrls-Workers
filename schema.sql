-- MyUrls D1数据库Schema
-- 创建时间: 2024-01-01

-- 短链接表
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    short_key TEXT UNIQUE NOT NULL,
    long_url TEXT NOT NULL,
    title TEXT,
    description TEXT,
    password_hash TEXT,
    max_visits INTEGER DEFAULT -1,
    max_devices INTEGER,
    visit_limit_mode TEXT DEFAULT 'devices',
    current_visits INTEGER DEFAULT 0,
    total_visits INTEGER DEFAULT 0,
    expires_at DATETIME,
    access_mode TEXT DEFAULT 'redirect',
    secure_mode BOOLEAN DEFAULT 1,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_visit_at DATETIME,
    created_by TEXT DEFAULT 'anonymous'
);

-- 访问记录表
CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    referer TEXT,
    country TEXT,
    city TEXT,
    region TEXT,
    risk_score INTEGER DEFAULT 0,
    is_proxy_tool BOOLEAN DEFAULT 0,
    proxy_tool_type TEXT,
    browser_detection JSON,
    visit_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- 设备表
CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT UNIQUE NOT NULL,
    fingerprint_data JSON,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT 0,
    block_reason TEXT,
    blocked_at DATETIME
);

-- IP地址表
CREATE TABLE IF NOT EXISTS ip_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip_address TEXT UNIQUE NOT NULL,
    country TEXT,
    city TEXT,
    region TEXT,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_blocked BOOLEAN DEFAULT 0,
    block_reason TEXT,
    blocked_at DATETIME
);

-- 链接设备关联表（用于设备数量限制）
CREATE TABLE IF NOT EXISTS link_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    first_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_access DATETIME DEFAULT CURRENT_TIMESTAMP,
    access_count INTEGER DEFAULT 1,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
    UNIQUE(link_id, device_id)
);

-- 风控配置表
CREATE TABLE IF NOT EXISTS risk_control_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    visit_limits JSON,
    ua_filter JSON,
    risk_alert JSON,
    country_restriction JSON,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- 自定义响应头表
CREATE TABLE IF NOT EXISTS custom_headers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    header_name TEXT NOT NULL,
    header_value TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

-- 标签表
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    color TEXT DEFAULT '#3B82F6',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 链接标签关联表
CREATE TABLE IF NOT EXISTS link_tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
    UNIQUE(link_id, tag_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_links_short_key ON links(short_key);
CREATE INDEX IF NOT EXISTS idx_links_created_at ON links(created_at);
CREATE INDEX IF NOT EXISTS idx_links_is_active ON links(is_active);
CREATE INDEX IF NOT EXISTS idx_access_logs_link_id ON access_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_device_id ON access_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_ip_address ON access_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_access_logs_visit_timestamp ON access_logs(visit_timestamp);
CREATE INDEX IF NOT EXISTS idx_devices_device_id ON devices(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_is_blocked ON devices(is_blocked);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_ip ON ip_addresses(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_addresses_is_blocked ON ip_addresses(is_blocked);
CREATE INDEX IF NOT EXISTS idx_link_devices_link_id ON link_devices(link_id);
CREATE INDEX IF NOT EXISTS idx_link_devices_device_id ON link_devices(device_id);
