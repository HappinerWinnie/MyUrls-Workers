# API 测试脚本
Write-Host "🧪 开始测试 MyUrls API 功能" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green

$baseUrl = "http://localhost:8788"

# 测试 1: 创建基本短链接
Write-Host "📝 测试 1: 创建基本短链接" -ForegroundColor Yellow
try {
    $response1 = Invoke-WebRequest -Uri "$baseUrl/api/links" -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"longUrl": "https://www.example.com/test-page", "title": "测试链接1"}'
    $result1 = $response1.Content | ConvertFrom-Json
    Write-Host "✅ 基本短链接创建成功" -ForegroundColor Green
    Write-Host "   短链接: $($result1.data.shortUrl)" -ForegroundColor Cyan
    $shortKey1 = $result1.data.shortKey
} catch {
    Write-Host "❌ 基本短链接创建失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试 2: 创建带访问次数限制的短链接（核心功能）
Write-Host "`n🎯 测试 2: 创建带访问次数限制的短链接" -ForegroundColor Yellow
try {
    $response2 = Invoke-WebRequest -Uri "$baseUrl/api/links" -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"longUrl": "https://www.google.com", "title": "访问限制测试", "maxVisits": 3}'
    $result2 = $response2.Content | ConvertFrom-Json
    Write-Host "✅ 限制访问短链接创建成功" -ForegroundColor Green
    Write-Host "   短链接: $($result2.data.shortUrl)" -ForegroundColor Cyan
    Write-Host "   访问限制: $($result2.data.maxVisits) 次" -ForegroundColor Cyan
    $shortKey2 = $result2.data.shortKey
} catch {
    Write-Host "❌ 限制访问短链接创建失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试 3: 创建自定义别名短链接
Write-Host "`n🔗 测试 3: 创建自定义别名短链接" -ForegroundColor Yellow
try {
    $response3 = Invoke-WebRequest -Uri "$baseUrl/api/links" -Method POST -Headers @{'Content-Type'='application/json'} -Body '{"longUrl": "https://www.github.com", "shortKey": "github", "title": "GitHub官网"}'
    $result3 = $response3.Content | ConvertFrom-Json
    Write-Host "✅ 自定义别名短链接创建成功" -ForegroundColor Green
    Write-Host "   短链接: $($result3.data.shortUrl)" -ForegroundColor Cyan
    $shortKey3 = $result3.data.shortKey
} catch {
    Write-Host "❌ 自定义别名短链接创建失败: $($_.Exception.Message)" -ForegroundColor Red
}

# 测试 4: 测试访问次数限制功能
if ($shortKey2) {
    Write-Host "`n🔄 测试 4: 测试访问次数限制功能" -ForegroundColor Yellow
    
    # 第一次访问
    try {
        $access1 = Invoke-WebRequest -Uri "$baseUrl/$shortKey2" -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Write-Host "✅ 第1次访问成功 (状态码: $($access1.StatusCode))" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 302 -or $_.Exception.Response.StatusCode -eq 301) {
            Write-Host "✅ 第1次访问成功 (重定向)" -ForegroundColor Green
        } else {
            Write-Host "❌ 第1次访问失败: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # 第二次访问
    try {
        $access2 = Invoke-WebRequest -Uri "$baseUrl/$shortKey2" -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Write-Host "✅ 第2次访问成功 (状态码: $($access2.StatusCode))" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 302 -or $_.Exception.Response.StatusCode -eq 301) {
            Write-Host "✅ 第2次访问成功 (重定向)" -ForegroundColor Green
        } else {
            Write-Host "❌ 第2次访问失败: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # 第三次访问
    try {
        $access3 = Invoke-WebRequest -Uri "$baseUrl/$shortKey2" -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Write-Host "✅ 第3次访问成功 (状态码: $($access3.StatusCode))" -ForegroundColor Green
    } catch {
        if ($_.Exception.Response.StatusCode -eq 302 -or $_.Exception.Response.StatusCode -eq 301) {
            Write-Host "✅ 第3次访问成功 (重定向)" -ForegroundColor Green
        } else {
            Write-Host "❌ 第3次访问失败: $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    # 第四次访问（应该被拒绝）
    try {
        $access4 = Invoke-WebRequest -Uri "$baseUrl/$shortKey2" -MaximumRedirection 0 -ErrorAction SilentlyContinue
        Write-Host "❌ 第4次访问不应该成功！" -ForegroundColor Red
    } catch {
        if ($_.Exception.Response.StatusCode -eq 403) {
            Write-Host "✅ 第4次访问被正确拒绝 (403 Forbidden)" -ForegroundColor Green
        } else {
            Write-Host "⚠️  第4次访问状态: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n🎉 API 测试完成！" -ForegroundColor Green
