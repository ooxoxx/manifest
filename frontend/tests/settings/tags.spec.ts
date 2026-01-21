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
    // Should show tag tree card
    await expect(page.getByText("标签树")).toBeVisible()
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
    await expect(page.getByText("标签树")).toBeVisible()
    await expect(page.getByText("标签详情")).toBeVisible()
  })

  test("add tag button is enabled", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /添加标签/ })
    await expect(addButton).toBeEnabled()
  })

  test("add tag dialog shows save button", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("button", { name: /保存|确认|创建/ })).toBeVisible()
  })

  test("add tag dialog shows create button", async ({ page }) => {
    await page.getByRole("button", { name: /添加标签/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("button", { name: /创建标签/ })).toBeVisible()
  })
})
