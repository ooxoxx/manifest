import { expect, test } from "../fixtures"

test.describe("MinIO Instances Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/minio")
    // Wait for page to load - check for h1 with MinIO title
    await expect(page.locator("h1")).toContainText(/MinIO/, {
      timeout: 15000,
    })
  })

  test("page loads with MinIO instances title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/MinIO/)
  })

  test("data table or empty state is displayed", async ({ page }) => {
    // Wait for table or content to load (Suspense fallback should resolve)
    await expect(
      page.locator("table").or(page.getByText(/暂无|No data|添加实例/i)),
    ).toBeVisible({ timeout: 15000 })
  })

  test("add instance button opens dialog", async ({ page }) => {
    // Click add instance button
    await page.getByRole("button", { name: /添加实例/ }).click()

    // Should show dialog for adding instance
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
  })

  test("add instance dialog has required fields", async ({ page }) => {
    // Click add instance button
    await page.getByRole("button", { name: /添加实例/ }).click()

    // Should show dialog with form fields
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Check for endpoint, access key, secret key fields
    await expect(page.getByLabel(/端点|Endpoint/i)).toBeVisible()
    await expect(page.getByLabel(/Access Key/i)).toBeVisible()
    await expect(page.getByLabel(/Secret Key/i)).toBeVisible()
  })

  test("can close add instance dialog", async ({ page }) => {
    // Click add instance button
    await page.getByRole("button", { name: /添加实例/ }).click()

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Press Escape to close
    await page.keyboard.press("Escape")

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
  })
})

// CRUD operations test suite - uses test MinIO instance
test.describe("MinIO CRUD Operations", () => {
  const testInstanceName = `E2E-Test-${Date.now()}`

  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/minio")
    await expect(page.locator("h1")).toContainText(/MinIO/, { timeout: 15000 })
  })

  test("can create MinIO instance with valid credentials", async ({ page }) => {
    // Click add instance button
    await page.getByRole("button", { name: /添加实例/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Fill in the form with test MinIO credentials
    await page.getByLabel(/名称/).fill(testInstanceName)
    await page.getByLabel(/端点/).fill("minio:9000")
    await page.getByLabel(/^Access Key/i).fill("minioadmin")
    await page.getByLabel(/^Secret Key/i).fill("minioadmin")

    // Disable HTTPS for local test instance
    const httpsSwitch = page.getByRole("switch")
    if (await httpsSwitch.isChecked()) {
      await httpsSwitch.click()
    }

    // Submit the form
    await page.getByRole("button", { name: /创建实例/ }).click()

    // Dialog should close and instance should appear in table
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 })
    await expect(page.getByText(testInstanceName)).toBeVisible({
      timeout: 5000,
    })
  })

  test("actions menu shows edit, test connection, and delete options", async ({
    page,
  }) => {
    // Wait for table with at least one row
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 })
    const rows = page.locator("table tbody tr")
    const rowCount = await rows.count()

    // Check if we have actual data rows (not just "未找到数据" empty state)
    const hasEmptyState = await page
      .getByText("未找到数据")
      .isVisible()
      .catch(() => false)

    if (rowCount > 0 && !hasEmptyState) {
      // Click the actions menu button on the first row
      await rows.first().getByRole("button").click()

      // Verify menu items are visible
      await expect(page.getByRole("menuitem", { name: /编辑/ })).toBeVisible()
      await expect(
        page.getByRole("menuitem", { name: /测试连接/ }),
      ).toBeVisible()
      await expect(page.getByRole("menuitem", { name: /删除/ })).toBeVisible()
    }
  })

  test("edit dialog opens with current values", async ({ page }) => {
    // Wait for table with at least one row
    await expect(page.locator("table")).toBeVisible({ timeout: 10000 })
    const rows = page.locator("table tbody tr")
    const rowCount = await rows.count()

    // Check if we have actual data rows (not just "未找到数据" empty state)
    const hasEmptyState = await page
      .getByText("未找到数据")
      .isVisible()
      .catch(() => false)

    if (rowCount > 0 && !hasEmptyState) {
      // Get the name from the first row for verification
      const firstRowName = await rows
        .first()
        .locator("td")
        .first()
        .textContent()

      // Click the actions menu button on the first row
      await rows.first().getByRole("button").click()

      // Click edit
      await page.getByRole("menuitem", { name: /编辑/ }).click()

      // Verify edit dialog opens
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
      await expect(
        page.getByRole("heading", { name: /编辑 MinIO 实例/ }),
      ).toBeVisible()

      // Verify name field is pre-filled
      const nameInput = page.getByLabel(/名称/)
      await expect(nameInput).toHaveValue(firstRowName || "")
    }
  })
})
