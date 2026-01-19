import { expect, test } from "@playwright/test"

/**
 * 数据集构建完整流程 E2E 测试
 *
 * 这些测试验证从筛选到创建的完整流程，特别关注：
 * 1. 筛选预览 API 调用
 * 2. 数据集创建 API 调用
 * 3. 创建后数据的持久化验证
 *
 * 这些测试会发现使用错误 API 调用方式的问题
 */

// 生成唯一的数据集名称，避免测试间冲突
const generateDatasetName = () => `E2E-Test-Dataset-${Date.now()}`

test.describe("Dataset Build - Complete Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/datasets/build")
    await expect(
      page.getByRole("heading", { name: /构建数据集|build dataset/i }),
    ).toBeVisible()
  })

  test("Full flow: Fill form → Preview → Build → Verify in list", async ({
    page,
  }) => {
    const datasetName = generateDatasetName()

    // Step 1: Fill in dataset info
    await page.getByLabel(/名称|name/i).fill(datasetName)
    await page.getByLabel(/描述|description/i).fill("E2E test dataset")

    // Step 2: Configure filters (if MinIO instance exists)
    const minioSelect = page.locator('[data-slot="select-trigger"]').filter({
      hasText: /选择 MinIO 实例|select minio/i,
    })

    // Check if there are MinIO instances available
    await minioSelect.click()
    const hasMinioOptions = await page
      .getByRole("option")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (hasMinioOptions) {
      // Select first MinIO instance
      await page.getByRole("option").first().click()

      // Fill in bucket
      const bucketInput = page.getByPlaceholder(/bucket/i)
      if (await bucketInput.isVisible()) {
        await bucketInput.fill("test-bucket")
      }
    } else {
      // Close dropdown if no options
      await page.keyboard.press("Escape")
    }

    // Step 3: Click preview to test filter-preview API
    const previewButton = page.getByRole("button", { name: /预览|preview/i })

    // Check if preview button exists and is enabled
    if (await previewButton.isEnabled({ timeout: 1000 }).catch(() => false)) {
      await previewButton.click()

      // Wait for preview results (API call)
      // Should show preview count or "no samples" message
      await expect(
        page.getByText(/找到|found|样本|samples|0|暂无/i),
      ).toBeVisible({ timeout: 10000 })
    }

    // Step 4: Build the dataset
    const buildButton = page.getByRole("button", { name: /构建数据集|build/i })
    await expect(buildButton).toBeEnabled()
    await buildButton.click()

    // Wait for build to complete
    // Should either redirect to dataset page or show success message
    await Promise.race([
      page.waitForURL(/\/datasets\/[a-f0-9-]+/i, { timeout: 15000 }),
      expect(page.getByText(/成功|success|created/i)).toBeVisible({
        timeout: 15000,
      }),
    ])

    // Step 5: Verify dataset exists in list
    await page.goto("/datasets")
    await expect(page.getByRole("table")).toBeVisible()

    // The created dataset should appear in the list
    await expect(page.getByRole("cell", { name: datasetName })).toBeVisible({
      timeout: 5000,
    })

    // Step 6: Cleanup - delete the dataset
    const datasetRow = page.getByRole("row").filter({ hasText: datasetName })
    await datasetRow.getByRole("button").click()
    await page.getByRole("menuitem", { name: /删除|delete/i }).click()

    // Confirm deletion
    const confirmButton = page.getByRole("button", {
      name: /确认|confirm|删除/i,
    })
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify deletion
    await expect(page.getByRole("cell", { name: datasetName })).not.toBeVisible(
      { timeout: 5000 },
    )
  })

  test("Filter preview shows sample count", async ({ page }) => {
    // This test specifically verifies the filter-preview API call works

    // Check if MinIO instance selector has options
    const minioSelect = page.locator('[data-slot="select-trigger"]').filter({
      hasText: /选择 MinIO 实例|select minio/i,
    })
    await minioSelect.click()

    const hasMinioOptions = await page
      .getByRole("option")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (!hasMinioOptions) {
      test.skip(true, "No MinIO instances configured")
      return
    }

    // Select first MinIO instance
    await page.getByRole("option").first().click()

    // Fill bucket
    const bucketInput = page.getByPlaceholder(/bucket/i)
    await bucketInput.fill("test-bucket")

    // Click preview
    const previewButton = page.getByRole("button", { name: /预览|preview/i })
    await previewButton.click()

    // Should show preview results from API
    // If API fails, this assertion will fail
    await expect(
      page.getByText(/找到|found|样本|samples|结果|result/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test("Build button disabled without dataset name", async ({ page }) => {
    // Clear name field
    const nameInput = page.getByLabel(/名称|name/i)
    await nameInput.clear()

    // Build button should be disabled
    const buildButton = page.getByRole("button", { name: /构建数据集|build/i })
    await expect(buildButton).toBeDisabled()
  })

  test("Sampling mode changes available options", async ({ page }) => {
    // Find sampling mode selector
    const samplingSelect = page.locator('[data-slot="select-trigger"]').filter({
      hasText: /全部|all|采样模式/i,
    })

    if (
      !(await samplingSelect.isVisible({ timeout: 2000 }).catch(() => false))
    ) {
      test.skip(true, "Sampling mode selector not found")
      return
    }

    await samplingSelect.click()

    // Select random sampling
    await page.getByRole("option", { name: /随机|random/i }).click()

    // Should show count input
    await expect(page.getByLabel(/采样数量|count|数量/i)).toBeVisible()

    // Should show seed input
    await expect(page.getByLabel(/随机种子|seed/i)).toBeVisible()
  })
})

test.describe("Dataset Add Samples - Complete Flow", () => {
  // This test requires an existing dataset
  test("Full flow: Select dataset → Filter → Add samples → Verify count", async ({
    page,
  }) => {
    // First check if there are any datasets
    await page.goto("/datasets")
    await expect(page.getByRole("table")).toBeVisible()

    const datasetRow = page.getByRole("row").nth(1)
    const hasDatasets = await datasetRow
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    if (!hasDatasets) {
      test.skip(true, "No datasets exist for testing add samples")
      return
    }

    // Get dataset ID from row
    const actionsButton = datasetRow.getByRole("button")
    await actionsButton.click()

    // Click add samples
    await page.getByRole("menuitem", { name: /添加样本|add samples/i }).click()

    // Should navigate to add samples page
    await page.waitForURL(/\/datasets\/[a-f0-9-]+\/add-samples/i, {
      timeout: 5000,
    })

    // Page should load the filter panel
    await expect(page.getByText(/筛选条件|filter/i)).toBeVisible()

    // If API fails to load dataset details, the page would show an error
    // This tests the readDataset API call
    await expect(page.getByText(/错误|error|failed/i)).not.toBeVisible({
      timeout: 3000,
    })
  })
})

test.describe("Dataset List - API Verification", () => {
  test("Datasets page loads data from API", async ({ page }) => {
    await page.goto("/datasets")

    // Table should be visible
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 })

    // Should not show error state
    await expect(page.getByText(/错误|error|failed|无法加载/i)).not.toBeVisible(
      { timeout: 2000 },
    )
  })

  test("Can create and immediately see new dataset", async ({ page }) => {
    await page.goto("/datasets")

    // Click add button
    const addButton = page.getByRole("button", { name: /新建|add|create/i })
    await addButton.click()

    // Should open dialog
    await expect(page.getByRole("dialog")).toBeVisible()

    // Fill in name
    const datasetName = generateDatasetName()
    await page.getByLabel(/名称|name/i).fill(datasetName)

    // Submit
    await page.getByRole("button", { name: /保存|save|创建|create/i }).click()

    // Dialog should close
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })

    // Dataset should appear in list immediately
    // This verifies the API call succeeded and list was refreshed
    await expect(page.getByRole("cell", { name: datasetName })).toBeVisible({
      timeout: 5000,
    })

    // Cleanup
    const datasetRow = page.getByRole("row").filter({ hasText: datasetName })
    await datasetRow.getByRole("button").click()
    await page.getByRole("menuitem", { name: /删除|delete/i }).click()

    const confirmButton = page.getByRole("button", { name: /确认|confirm/i })
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click()
    }
  })
})
