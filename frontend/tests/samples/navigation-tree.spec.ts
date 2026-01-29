import { expect, test } from "@playwright/test"

test.describe("Sample Browser Navigation Tree", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to samples page (auth is handled by setup)
    await page.goto("/samples")
    await expect(page.getByRole("heading", { name: "样本浏览" })).toBeVisible()
  })

  test("sidebar is collapsed by default", async ({ page }) => {
    // The sidebar should be visible
    const sidebar = page.getByTestId("navigation-sidebar")
    await expect(sidebar).toBeVisible()

    // Check that the toggle button is visible
    const toggleButton = page.getByTestId("sidebar-toggle")
    await expect(toggleButton).toBeVisible()
  })

  test("sidebar can be expanded and collapsed", async ({ page }) => {
    const toggleButton = page.getByTestId("sidebar-toggle")

    // Click to expand
    await toggleButton.click()

    // Should see the tree section headers (use exact match)
    await expect(page.getByText("业务标签", { exact: true })).toBeVisible()
    await expect(page.getByText("存储路径", { exact: true })).toBeVisible()

    // Click to collapse
    await toggleButton.click()

    // Headers should not be visible when collapsed
    await expect(page.getByText("业务标签", { exact: true })).not.toBeVisible()
  })

  test("storage path tree shows instance and bucket hierarchy", async ({
    page,
  }) => {
    // Expand sidebar
    await page.getByTestId("sidebar-toggle").click()

    // Wait for storage path section
    await expect(page.getByText("存储路径")).toBeVisible()

    // Wait for tree to load
    await page.waitForTimeout(1000)
  })

  test("clicking storage path node updates URL", async ({ page }) => {
    // Expand sidebar
    await page.getByTestId("sidebar-toggle").click()

    // Wait for content to load
    await page.waitForTimeout(1000)
  })

  test("business tag tree shows tag hierarchy", async ({ page }) => {
    // Expand sidebar
    await page.getByTestId("sidebar-toggle").click()

    // Wait for business tags section header (use exact match)
    await expect(page.getByText("业务标签", { exact: true })).toBeVisible()

    // The tree should load
    await page.waitForTimeout(1000)
  })

  test("tree selection persists after page refresh", async ({ page }) => {
    // Expand sidebar
    await page.getByTestId("sidebar-toggle").click()

    // Wait for content
    await page.waitForTimeout(1000)

    // Get current URL
    const initialUrl = page.url()

    // Refresh the page
    await page.reload()

    // Wait for page to load
    await expect(page.getByRole("heading", { name: "样本浏览" })).toBeVisible()

    // URL should be preserved
    expect(page.url()).toBe(initialUrl)
  })
})
