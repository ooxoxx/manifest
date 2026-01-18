# MinIO 测试容器设计

## 概述

添加一个用于本地开发和 E2E 测试的 MinIO 容器，通过 `docker-compose.override.yml` 配置，预置示例数据。

## 设计详情

### 1. MinIO 服务配置

在 `docker-compose.override.yml` 中添加：

```yaml
minio:
  image: minio/minio:latest
  ports:
    - "9000:9000"   # API 端口
    - "9001:9001"   # Console 端口
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
  volumes:
    - minio-data:/data
  healthcheck:
    test: ["CMD", "mc", "ready", "local"]
    interval: 5s
    timeout: 5s
    retries: 5
```

同时在 `volumes` 部分声明 `minio-data` 卷。

访问方式：
- **API**: `http://127.0.0.1:9000`
- **Console**: `http://127.0.0.1:9001`
- **凭据**: `minioadmin` / `minioadmin`

### 2. 示例数据初始化

使用初始化容器创建 bucket 并上传测试文件：

```yaml
minio-init:
  image: minio/mc:latest
  depends_on:
    minio:
      condition: service_healthy
  entrypoint: /bin/sh
  command: -c "
    mc alias set local http://minio:9000 minioadmin minioadmin &&
    mc mb --ignore-existing local/test-bucket &&
    mc cp /test-data/* local/test-bucket/ --recursive
    "
  volumes:
    - ./test-data/minio:/test-data
```

### 3. 测试数据目录结构

```
test-data/minio/
├── cat_001.jpg       # 有标注
├── cat_001.xml       # VOC 标注
├── cat_002.jpg       # 有标注
├── cat_002.xml       # VOC 标注
├── dog_001.jpg       # 无标注
├── dog_002.png       # 有标注
├── dog_002.xml       # VOC 标注
└── bird_001.jpg      # 无标注
```

5 张图片中 3 张有对应 VOC 标注，2 张没有。图片和标注放在同一目录，通过相同文件名（不含扩展名）关联。

### 4. 测试文件内容

**图片文件**：小尺寸占位图片（100x100 像素），纯色或渐变图片，减小仓库体积。

**VOC 标注文件**：标准 XML 格式，示例：

```xml
<annotation>
  <filename>cat_001.jpg</filename>
  <size>
    <width>100</width>
    <height>100</height>
  </size>
  <object>
    <name>cat</name>
    <bndbox>
      <xmin>10</xmin><ymin>10</ymin>
      <xmax>90</xmax><ymax>90</ymax>
    </bndbox>
  </object>
</annotation>
```

### 5. CLAUDE.md 文档更新

在 URLs 列表后添加：

```markdown
# MinIO (测试用):  http://127.0.0.1:9001 (Console)
# MinIO API:       http://127.0.0.1:9000
# 凭据: minioadmin / minioadmin
```

在 "Important Notes" 部分添加：

```markdown
- **MinIO 测试实例**
  - 仅在 `docker-compose.override.yml` 中配置，用于本地开发和 E2E 测试
  - 预置 `test-bucket`，包含示例图片和 VOC 标注文件（部分有标注，部分无）
  - E2E 测试中添加 MinIO 实例时使用：
    - Endpoint: `minio:9000`（容器内）或 `127.0.0.1:9000`（本机）
    - Access Key: `minioadmin`
    - Secret Key: `minioadmin`
    - Secure: `false`
```

## 使用场景

1. **开发调试**：通过 Console (9001) 直接管理文件，手动测试 MinIO 相关功能
2. **E2E 测试**：Playwright 测试中验证 MinIO 实例添加、连接测试、样本导入等功能
3. **标注匹配测试**：验证有标注/无标注的样本导入逻辑
