import { expect, test } from "@playwright/test"

// Note: Authentication is handled by auth.setup.ts via storageState

test.describe("Dataset Build Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/datasets")
  })

  test("Datasets page shows build wizard link", async ({ page }) => {
    // Should show the build wizard button
    await expect(
      page.getByRole("link", { name: /构建数据集|build/i })
    ).toBeVisible()
  })

  test("Can navigate to build wizard", async ({ page }) => {
    // Click build wizard button
    await page.getByRole("link", { name: /构建数据集|build/i }).click()

    // Should navigate to build page
    await page.waitForURL("/datasets/build")
    await expect(
      page.getByRole("heading", { name: /构建数据集|build dataset/i })
    ).toBeVisible()
  })

  test("Build wizard shows all required sections", async ({ page }) => {
    await page.goto("/datasets/build")

    // Should show dataset info card
    await expect(page.getByText(/数据集信息|dataset info/i)).toBeVisible()
    await expect(page.getByLabel(/名称|name/i)).toBeVisible()

    // Should show filter panel
    await expect(page.getByText(/筛选条件|filter/i)).toBeVisible()
    await expect(page.getByText(/MinIO 实例/i)).toBeVisible()

    // Should show sampling config
    await expect(page.getByText(/采样配置|sampling config/i)).toBeVisible()
    await expect(page.getByText(/采样模式/i)).toBeVisible()

    // Should show preview button
    await expect(
      page.getByRole("button", { name: /预览|preview/i })
    ).toBeVisible()

    // Should show build button
    await expect(
      page.getByRole("button", { name: /构建数据集|build/i })
    ).toBeVisible()
  })

  test("Can fill in dataset name", async ({ page }) => {
    await page.goto("/datasets/build")

    // Fill in dataset name
    const nameInput = page.getByLabel(/名称|name/i)
    await nameInput.fill("Test Dataset")
    await expect(nameInput).toHaveValue("Test Dataset")

    // Fill in description
    const descInput = page.getByLabel(/描述|description/i)
    await descInput.fill("Test description")
    await expect(descInput).toHaveValue("Test description")
  })

  test("Can select sampling mode", async ({ page }) => {
    await page.goto("/datasets/build")

    // Click on sampling mode selector
    const samplingModeSelect = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /全部|all/i })
    await samplingModeSelect.click()

    // Should show mode options
    await expect(
      page.getByRole("option", { name: /随机采样|random/i })
    ).toBeVisible()
  })

  test("Random mode shows count input", async ({ page }) => {
    await page.goto("/datasets/build")

    // Select random sampling mode
    const samplingModeSelect = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /全部|all/i })
    await samplingModeSelect.click()
    await page.getByRole("option", { name: /随机采样|random/i }).click()

    // Should show count input
    await expect(page.getByLabel(/采样数量|count/i)).toBeVisible()

    // Should show seed input
    await expect(page.getByLabel(/随机种子|seed/i)).toBeVisible()
  })

  test("Back button returns to datasets page", async ({ page }) => {
    await page.goto("/datasets/build")

    // Click back button
    await page.getByRole("button").first().click()

    // Should return to datasets page
    await page.waitForURL("/datasets")
    await expect(
      page.getByRole("heading", { name: /数据集|datasets/i })
    ).toBeVisible()
  })

  test("Build button requires dataset name", async ({ page }) => {
    await page.goto("/datasets/build")

    // Build button should be disabled without name
    const buildButton = page.getByRole("button", { name: /构建数据集|build/i })
    await expect(buildButton).toBeDisabled()

    // Fill in name
    await page.getByLabel(/名称|name/i).fill("Test Dataset")

    // Build button should be enabled
    await expect(buildButton).toBeEnabled()
  })
})

test.describe("Dataset Add Samples", () => {
  test("Datasets table shows actions menu", async ({ page }) => {
    await page.goto("/datasets")

    // Create a dataset first if none exists
    // Check if there's an existing dataset row
    const datasetRow = page.getByRole("row").nth(1)
    const hasDatasets = await datasetRow.isVisible().catch(() => false)

    if (hasDatasets) {
      // Click on actions button
      await datasetRow.getByRole("button").click()

      // Should show add samples option
      await expect(page.getByText(/添加样本|add samples/i)).toBeVisible()
    }
  })
})

test.describe("Filter Panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/datasets/build")
  })

  test("Can select MinIO instance from dropdown", async ({ page }) => {
    // Click MinIO instance selector
    const minioSelect = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /选择 MinIO 实例/i })
    await minioSelect.click()

    // Wait for options to load (API call)
    await page.waitForTimeout(1000)

    // Should show MinIO options if any exist
    const options = page.getByRole("option")
    const optionCount = await options.count()
    if (optionCount > 0) {
      await expect(options.first()).toBeVisible()
    }
  })

  test("Can fill in bucket name", async ({ page }) => {
    const bucketInput = page.getByPlaceholder(/bucket/i)
    await bucketInput.fill("test-bucket")
    await expect(bucketInput).toHaveValue("test-bucket")
  })

  test("Can fill in prefix", async ({ page }) => {
    const prefixInput = page.getByPlaceholder(/images\/train/i)
    await prefixInput.fill("images/2024/")
    await expect(prefixInput).toHaveValue("images/2024/")
  })

  test("Can set date range", async ({ page }) => {
    // Find date inputs
    const dateFromInput = page.locator('input[type="date"]').first()
    const dateToInput = page.locator('input[type="date"]').last()

    await dateFromInput.fill("2024-01-01")
    await dateToInput.fill("2024-12-31")

    await expect(dateFromInput).toHaveValue("2024-01-01")
    await expect(dateToInput).toHaveValue("2024-12-31")
  })

  test("Can select annotation status", async ({ page }) => {
    // Click annotation status selector
    const statusSelect = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /全部状态/i })
    await statusSelect.click()

    // Should show status options
    await expect(page.getByRole("option", { name: /已关联|linked/i })).toBeVisible()
    await expect(page.getByRole("option", { name: /无标注|none/i })).toBeVisible()
  })
})
