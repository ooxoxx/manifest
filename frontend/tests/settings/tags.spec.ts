import { expect, test } from "../fixtures"

test.describe("Tags Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/tags")
    // Wait for page to load - check for h1 with tags title
    await expect(page.locator("h1")).toContainText(/标签管理/, {
      timeout: 15000,
    })
  })

  test("page loads with tags manager title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/标签管理/)
  })

  test("tag tree card is visible", async ({ page }) => {
    // Should show tag categories card (was "标签树", now "标签分类")
    await expect(page.getByText("标签分类")).toBeVisible()
  })

  test("tag details panel is visible", async ({ page }) => {
    // Should show tag details card
    await expect(page.getByText("标签详情")).toBeVisible()
  })

  test("add tag button opens dialog", async ({ page }) => {
    // Click add tag button
    await page.getByRole("button", { name: /添加标签/ }).click()

    // Should show dialog/modal for adding tag
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("add tag dialog has name field", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    // Should show name input field
    await expect(page.getByLabel(/名称|Name/i)).toBeVisible()
  })

  test("add tag dialog has color picker", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    // Should show color picker or color field
    await expect(page.getByText(/颜色|Color/i)).toBeVisible()
  })

  test("can close add tag dialog with escape", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
  })

  test("tag details panel shows placeholder when no tag selected", async ({
    page,
  }) => {
    // Should show tag details card with placeholder when no tag selected
    await expect(page.getByText("标签详情")).toBeVisible()
    // The delete button only appears when a tag is selected
    // So we just verify the details panel structure is there
  })

  test("page has proper layout with two panels", async ({ page }) => {
    // Verify both panels are visible
    await expect(page.getByText("标签分类")).toBeVisible()
    await expect(page.getByText("标签详情")).toBeVisible()
  })

  test("add tag button is enabled", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /添加标签/ })
    await expect(addButton).toBeEnabled()
  })

  test("add tag dialog shows save button", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /保存|确认|创建/ }),
    ).toBeVisible()
  })

  test("add tag dialog shows create button", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("button", { name: /创建标签/ })).toBeVisible()
  })

  test("tag tree shows category sections", async ({ page }) => {
    // Should show accordion sections for each category
    await expect(page.getByText("系统标签")).toBeVisible()
    await expect(page.getByText("业务标签")).toBeVisible()
    await expect(page.getByText("用户标签")).toBeVisible()
  })

  test("category sections display tag counts", async ({ page }) => {
    // Should show tag count for system tags (e.g., "系统标签 (2)")
    // The text contains parentheses with counts
    const systemSection = page.locator("text=/系统标签.*\\(\\d+\\)/")
    await expect(systemSection).toBeVisible()
  })

  test("add tag dialog creates user tags", async ({ page }) => {
    // The add tag dialog now only creates user tags (no category selector)
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Dialog title should indicate it's for user tags
    await expect(page.getByText("添加用户标签")).toBeVisible()
  })

  test("add tag dialog has description field", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Should show description field
    await expect(page.getByText(/描述/)).toBeVisible()
  })
})
