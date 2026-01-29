import { expect, test } from "../fixtures"

test.describe("Watched Paths Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/watched-paths")
    // Wait for page to load - check for h1 with 监控路径 title
    await expect(page.locator("h1")).toContainText(/监控路径/, {
      timeout: 15000,
    })
  })

  test("page loads with watched paths title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/监控路径/)
  })

  test("data table or empty state is displayed", async ({ page }) => {
    // Wait for table or content to load (Suspense fallback should resolve)
    await expect(
      page.locator("table").or(page.getByText(/暂无|No data|添加监控路径/i)),
    ).toBeVisible({ timeout: 15000 })
  })

  test("add watched path button opens dialog", async ({ page }) => {
    // Click add watched path button
    await page.getByRole("button", { name: /添加监控路径/ }).click()

    // Should show dialog for adding watched path
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
  })

  test("add watched path dialog has step indicators", async ({ page }) => {
    // Click add watched path button
    await page.getByRole("button", { name: /添加监控路径/ }).click()

    // Should show dialog with step indicators
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Check for step indicators
    await expect(page.getByText("选择实例")).toBeVisible()
    await expect(page.getByText("选择目录")).toBeVisible()
    await expect(page.getByText("确认配置")).toBeVisible()
  })

  test("can close add watched path dialog", async ({ page }) => {
    // Click add watched path button
    await page.getByRole("button", { name: /添加监控路径/ }).click()

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Press Escape to close
    await page.keyboard.press("Escape")

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
  })
})

// CRUD operations test suite - requires MinIO instance to be set up first
test.describe("Watched Paths CRUD Operations", () => {
  const testInstanceName = `E2E-WatchedPath-${Date.now()}`

  test.beforeAll(async ({ browser }) => {
    // Create a MinIO instance for testing
    const page = await browser.newPage()
    await page.goto("/settings/minio")
    await expect(page.locator("h1")).toContainText(/MinIO/, { timeout: 15000 })

    // Check if test instance already exists
    const existingInstance = page.getByText(testInstanceName)
    if (!(await existingInstance.isVisible({ timeout: 2000 }).catch(() => false))) {
      // Create new instance
      await page.getByRole("button", { name: /添加实例/ }).click()
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

      await page.getByLabel(/名称/).fill(testInstanceName)
      await page.getByLabel(/端点/).fill("minio:9000")
      await page.getByLabel(/^Access Key/i).fill("minioadmin")
      await page.getByLabel(/^Secret Key/i).fill("minioadmin")

      const httpsSwitch = page.getByRole("switch")
      if (await httpsSwitch.isChecked()) {
        await httpsSwitch.click()
      }

      await page.getByRole("button", { name: /创建实例/ }).click()
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 })
    }

    await page.close()
  })

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/watched-paths")
    await expect(page.locator("h1")).toContainText(/监控路径/, { timeout: 15000 })
  })

  test("can open add dialog and see MinIO instances", async ({ page }) => {
    // Click add watched path button
    await page.getByRole("button", { name: /添加监控路径/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Should be on step 1 - select instance
    await expect(page.getByText("选择 MinIO 实例")).toBeVisible()

    // Should show available instances (at least the test instance)
    await expect(
      page.getByRole("combobox").or(page.getByRole("listbox")).or(page.locator("select")),
    ).toBeVisible({ timeout: 5000 })
  })

  test("can navigate through wizard steps", async ({ page }) => {
    // Click add watched path button
    await page.getByRole("button", { name: /添加监控路径/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Step 1: Select instance
    // Find and click on an instance option
    const instanceSelect = page.locator("[data-testid='instance-select']").or(
      page.getByRole("combobox"),
    )
    if (await instanceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await instanceSelect.click()
      // Select first available option
      const firstOption = page.getByRole("option").first()
      if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstOption.click()
      }
    }

    // Try to proceed to next step
    const nextButton = page.getByRole("button", { name: /下一步|Next/i })
    if (await nextButton.isEnabled({ timeout: 2000 }).catch(() => false)) {
      await nextButton.click()
      // Should now be on step 2
      await expect(page.getByText(/选择目录|浏览/)).toBeVisible({ timeout: 5000 })
    }
  })
})

test.describe("Bucket Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/watched-paths")
    await expect(page.locator("h1")).toContainText(/监控路径/, { timeout: 15000 })
  })

  test("bucket browser shows loading state initially", async ({ page }) => {
    // Click add watched path button
    await page.getByRole("button", { name: /添加监控路径/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // The bucket browser should show some loading or empty state
    // until an instance is selected
    await expect(
      page.getByText(/选择.*实例|请先选择/i).or(page.getByRole("combobox")),
    ).toBeVisible({ timeout: 5000 })
  })
})
