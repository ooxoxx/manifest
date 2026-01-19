# MinIO Test Container Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a MinIO test container with pre-seeded sample data for local development and E2E testing.

**Architecture:** Add MinIO service and init container to docker-compose.override.yml. Create test data directory with sample images and VOC annotations. Update CLAUDE.md documentation.

**Tech Stack:** Docker Compose, MinIO, MinIO Client (mc)

---

### Task 1: Add MinIO Service to Docker Compose

**Files:**
- Modify: `docker-compose.override.yml:131` (before networks section)

**Step 1: Add minio service configuration**

Add the following before the `networks:` section (around line 131):

```yaml
  minio:
    image: minio/minio:latest
    restart: "no"
    ports:
      - "9000:9000"
      - "9001:9001"
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

**Step 2: Verify YAML syntax**

Run: `docker compose config --quiet`
Expected: No output (valid syntax)

**Step 3: Commit**

```bash
git add docker-compose.override.yml
git commit -m "feat: add MinIO service to docker-compose.override.yml"
```

---

### Task 2: Add MinIO Init Container and Volume

**Files:**
- Modify: `docker-compose.override.yml`

**Step 1: Add minio-init service after minio service**

```yaml
  minio-init:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: /bin/sh
    command: >
      -c "
      mc alias set local http://minio:9000 minioadmin minioadmin &&
      mc mb --ignore-existing local/test-bucket &&
      mc cp /test-data/* local/test-bucket/ --recursive &&
      echo 'MinIO initialized with test data'
      "
    volumes:
      - ./test-data/minio:/test-data:ro
```

**Step 2: Add volumes section at end of file**

```yaml
volumes:
  minio-data:
```

**Step 3: Verify YAML syntax**

Run: `docker compose config --quiet`
Expected: No output (valid syntax)

**Step 4: Commit**

```bash
git add docker-compose.override.yml
git commit -m "feat: add MinIO init container and volume"
```

---

### Task 3: Create Test Data Directory Structure

**Files:**
- Create: `test-data/minio/` directory

**Step 1: Create directory**

```bash
mkdir -p test-data/minio
```

**Step 2: Verify directory exists**

Run: `ls -la test-data/minio`
Expected: Empty directory listing

**Step 3: Commit**

```bash
git add test-data/
git commit -m "feat: create test-data/minio directory for MinIO test files"
```

---

### Task 4: Create Test Images

**Files:**
- Create: `test-data/minio/cat_001.jpg`
- Create: `test-data/minio/cat_002.jpg`
- Create: `test-data/minio/dog_001.jpg`
- Create: `test-data/minio/dog_002.png`
- Create: `test-data/minio/bird_001.jpg`

**Step 1: Create placeholder images using Python**

Create a script to generate 100x100 colored placeholder images:

```bash
docker compose exec backend python -c "
from PIL import Image
import os

os.makedirs('/app/test-images', exist_ok=True)

colors = {
    'cat_001.jpg': (255, 100, 100),   # red-ish
    'cat_002.jpg': (255, 150, 150),   # light red
    'dog_001.jpg': (100, 100, 255),   # blue-ish
    'dog_002.png': (100, 150, 255),   # light blue
    'bird_001.jpg': (100, 255, 100),  # green-ish
}

for filename, color in colors.items():
    img = Image.new('RGB', (100, 100), color)
    img.save(f'/app/test-images/{filename}')
    print(f'Created {filename}')
"
```

**Step 2: Copy images to test-data directory**

```bash
docker compose cp backend:/app/test-images/. test-data/minio/
```

**Step 3: Verify images created**

Run: `ls -la test-data/minio/`
Expected: 5 image files (cat_001.jpg, cat_002.jpg, dog_001.jpg, dog_002.png, bird_001.jpg)

**Step 4: Commit**

```bash
git add test-data/minio/
git commit -m "feat: add placeholder test images for MinIO"
```

---

### Task 5: Create VOC Annotation Files

**Files:**
- Create: `test-data/minio/cat_001.xml`
- Create: `test-data/minio/cat_002.xml`
- Create: `test-data/minio/dog_002.xml`

**Step 1: Create cat_001.xml**

```xml
<annotation>
  <filename>cat_001.jpg</filename>
  <size>
    <width>100</width>
    <height>100</height>
    <depth>3</depth>
  </size>
  <object>
    <name>cat</name>
    <bndbox>
      <xmin>10</xmin>
      <ymin>10</ymin>
      <xmax>90</xmax>
      <ymax>90</ymax>
    </bndbox>
  </object>
</annotation>
```

**Step 2: Create cat_002.xml**

```xml
<annotation>
  <filename>cat_002.jpg</filename>
  <size>
    <width>100</width>
    <height>100</height>
    <depth>3</depth>
  </size>
  <object>
    <name>cat</name>
    <bndbox>
      <xmin>20</xmin>
      <ymin>15</ymin>
      <xmax>85</xmax>
      <ymax>95</ymax>
    </bndbox>
  </object>
</annotation>
```

**Step 3: Create dog_002.xml**

```xml
<annotation>
  <filename>dog_002.png</filename>
  <size>
    <width>100</width>
    <height>100</height>
    <depth>3</depth>
  </size>
  <object>
    <name>dog</name>
    <bndbox>
      <xmin>5</xmin>
      <ymin>5</ymin>
      <xmax>95</xmax>
      <ymax>95</ymax>
    </bndbox>
  </object>
</annotation>
```

**Step 4: Verify annotation files**

Run: `ls -la test-data/minio/*.xml`
Expected: 3 XML files (cat_001.xml, cat_002.xml, dog_002.xml)

**Step 5: Commit**

```bash
git add test-data/minio/*.xml
git commit -m "feat: add VOC annotation files for test images"
```

---

### Task 6: Update CLAUDE.md Documentation

**Files:**
- Modify: `CLAUDE.md:30-31` (after Mailcatcher URL)

**Step 1: Add MinIO URLs to Development section**

After line 30 (`# Mailcatcher:     http://127.0.0.1:1080`), add:

```markdown
# MinIO Console:  http://127.0.0.1:9001
# MinIO API:      http://127.0.0.1:9000
# MinIO 凭据:     minioadmin / minioadmin
```

**Step 2: Add MinIO test instance section to Important Notes**

After line 205 (last line), add:

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

**Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: add MinIO test instance documentation"
```

---

### Task 7: Test the Complete Setup

**Files:** None (verification only)

**Step 1: Restart docker compose**

```bash
docker compose down
docker compose up -d
```

**Step 2: Wait for MinIO to be healthy**

```bash
docker compose ps minio
```
Expected: Status shows "healthy"

**Step 3: Verify MinIO Console access**

Open browser: `http://127.0.0.1:9001`
Login with: `minioadmin` / `minioadmin`
Expected: MinIO Console loads successfully

**Step 4: Verify test-bucket exists with files**

```bash
docker compose exec minio mc ls local/test-bucket/
```
Expected: Lists 8 files (5 images + 3 XML annotations)

**Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: adjustments from testing MinIO setup"
```

---

## Summary

| File | Images with Annotation | Images without Annotation |
|------|------------------------|---------------------------|
| cat_001.jpg | ✓ (cat_001.xml) | |
| cat_002.jpg | ✓ (cat_002.xml) | |
| dog_001.jpg | | ✓ |
| dog_002.png | ✓ (dog_002.xml) | |
| bird_001.jpg | | ✓ |

**Total:** 5 images, 3 with VOC annotations, 2 without.
