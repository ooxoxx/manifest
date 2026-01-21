import { expect, test } from "./fixtures"

test.describe("Route Redirects", () => {
  test("root path redirects to /ops or shows authenticated content", async ({
    page,
  }) => {
    await page.goto("/")
    // Wait for page content to load - check for h1 with ops center title
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 })
    // Should redirect to ops or show ops content
    await expect(page).toHaveURL(/ops/, { timeout: 5000 })
  })

  test("unauthenticated access to protected routes redirects to login", async ({
    browser,
  }) => {
    // Create a new context without stored auth
    const context = await browser.newContext({
      storageState: { cookies: [], origins: [] },
    })
    const page = await context.newPage()

    await page.goto("/ops")
    await expect(page).toHaveURL(/login/, { timeout: 15000 })

    await context.close()
  })
})

test.describe("Sidebar Navigation - Workbench", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ops")
    // Wait for h1 to be visible (indicates page is loaded)
    await expect(page.locator("h1")).toContainText(/运维中心/, {
      timeout: 15000,
    })
  })

  test("clicking '样本入库' navigates to /import", async ({ page }) => {
    // Find sidebar link by its text content
    await page.getByRole("link", { name: "样本入库" }).click()
    await expect(page).toHaveURL(/import/)
  })

  test("clicking '数据集构建' navigates to /build", async ({ page }) => {
    await page.getByRole("link", { name: "数据集构建" }).click()
    await expect(page).toHaveURL(/build/)
  })

  test("clicking '运维中心' navigates to /ops", async ({ page }) => {
    // Navigate away first
    await page.goto("/samples")
    await expect(page.locator("h1")).toContainText(/样本/, { timeout: 10000 })

    await page.getByRole("link", { name: "运维中心" }).click()
    await expect(page).toHaveURL(/ops/)
  })
})

test.describe("Sidebar Navigation - Browse", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ops")
    await expect(page.locator("h1")).toContainText(/运维中心/, {
      timeout: 15000,
    })
  })

  test("clicking '样本浏览' navigates to /samples", async ({ page }) => {
    await page.getByRole("link", { name: "样本浏览" }).click()
    await expect(page).toHaveURL(/samples/, { timeout: 10000 })
  })

  test("clicking '数据集浏览' navigates to /datasets", async ({ page }) => {
    await page.getByRole("link", { name: "数据集浏览" }).click()
    await expect(page).toHaveURL(/datasets/, { timeout: 10000 })
  })
})

test.describe("Sidebar Navigation - Settings", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ops")
    await expect(page.locator("h1")).toContainText(/运维中心/, {
      timeout: 15000,
    })
  })

  test("clicking '标签管理' navigates to /settings/tags", async ({ page }) => {
    await page.getByRole("link", { name: "标签管理" }).click()
    await expect(page).toHaveURL(/settings\/tags/, { timeout: 10000 })
  })
})
