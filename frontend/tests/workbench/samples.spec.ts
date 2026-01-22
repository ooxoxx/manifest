import { expect, test } from "../fixtures"

test.describe("Samples Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/samples")
    // Wait for page to load - check for h1 with samples title
    await expect(page.locator("h1")).toContainText(/样本浏览/, {
      timeout: 15000,
    })
  })

  test("page loads with samples title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/样本/)
  })

  test("view mode toggle buttons are visible", async ({ page }) => {
    // The page should have view mode toggles - using aria-label
    await expect(page.getByLabel(/网格模式/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel(/列表模式/)).toBeVisible()
  })

  test("grid view shows samples or empty state", async ({ page }) => {
    // Grid mode is the default, wait for content to load
    // Either shows sample count or empty state message
    await expect(
      page.getByText(/共.*个样本/).or(page.getByText(/没有找到/)),
    ).toBeVisible({ timeout: 10000 })
  })

  test("clicking list mode toggle shows coming soon message", async ({
    page,
  }) => {
    // Wait for grid content to load first
    await expect(
      page.getByText(/共.*个样本/).or(page.getByText(/没有找到/)),
    ).toBeVisible({ timeout: 10000 })

    // Click list view mode toggle
    await page.getByLabel(/列表模式/).click()

    // Should show coming soon message
    await expect(page.getByText(/列表视图即将推出/)).toBeVisible({
      timeout: 5000,
    })
  })

  test("can switch between grid and list modes", async ({ page }) => {
    // Wait for grid content to load
    await expect(
      page.getByText(/共.*个样本/).or(page.getByText(/没有找到/)),
    ).toBeVisible({ timeout: 10000 })

    // Switch to list mode
    await page.getByLabel(/列表模式/).click()
    await expect(page.getByText(/列表视图即将推出/)).toBeVisible()

    // Switch back to grid mode
    await page.getByLabel(/网格模式/).click()
    await expect(
      page.getByText(/共.*个样本/).or(page.getByText(/没有找到/)),
    ).toBeVisible({ timeout: 5000 })
  })

  test("import button is visible", async ({ page }) => {
    // Should have an import button
    await expect(page.getByRole("link", { name: /导入样本/ })).toBeVisible({
      timeout: 10000,
    })
  })
})
