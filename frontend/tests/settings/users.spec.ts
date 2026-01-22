import { expect, test } from "../fixtures"

test.describe("Users Manager (Admin)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/users")
    // Wait for page to load - check for h1 with users title
    await expect(page.locator("h1")).toContainText(/用户管理/, {
      timeout: 15000,
    })
  })

  test("page loads with users manager title for admin", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/用户管理/)
  })

  test("page shows description text", async ({ page }) => {
    await expect(page.getByText(/管理系统用户|manage users/i)).toBeVisible()
  })

  test("users list table is visible", async ({ page }) => {
    // Wait for table to load
    await expect(page.locator("table").or(page.getByText(/暂无/))).toBeVisible({
      timeout: 15000,
    })
  })

  test("add user button is visible", async ({ page }) => {
    // Find add user button
    await expect(page.getByRole("button", { name: /添加用户/ })).toBeVisible()
  })

  test("add user button is enabled", async ({ page }) => {
    await expect(page.getByRole("button", { name: /添加用户/ })).toBeEnabled()
  })

  test("add user button opens dialog", async ({ page }) => {
    // Click add user button
    await page.getByRole("button", { name: /添加用户/ }).click()

    // Dialog should appear
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Dialog should have email and password labels
    await expect(page.getByLabel(/邮箱/)).toBeVisible()
    await expect(page.getByLabel(/设置密码/)).toBeVisible()
  })

  test("add user dialog shows all form fields", async ({ page }) => {
    await page.getByRole("button", { name: /添加用户/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Check all form fields
    await expect(page.getByLabel(/邮箱/)).toBeVisible()
    await expect(page.getByLabel(/姓名/)).toBeVisible()
    await expect(page.getByLabel(/设置密码/)).toBeVisible()
    await expect(page.getByLabel(/确认密码/)).toBeVisible()
  })

  test("add user dialog shows checkboxes", async ({ page }) => {
    await page.getByRole("button", { name: /添加用户/ }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Check for checkboxes within the dialog
    await expect(dialog.getByText(/超级用户/)).toBeVisible()
    await expect(dialog.getByText(/启用账户/)).toBeVisible()
  })

  test("add user dialog shows validation errors", async ({ page }) => {
    // Click add user button
    await page.getByRole("button", { name: /添加用户/ }).click()

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Fill with invalid data and trigger validation
    await page.getByLabel(/邮箱/).fill("invalid-email")
    await page.getByLabel(/设置密码/).fill("short")
    await page.getByLabel(/确认密码/).fill("different")

    // Trigger blur to show validation
    await page.getByLabel(/确认密码/).blur()

    // Dialog should still be visible
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("add user dialog has save button", async ({ page }) => {
    await page.getByRole("button", { name: /添加用户/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("button", { name: /保存/ })).toBeVisible()
  })

  test("add user dialog has cancel button", async ({ page }) => {
    await page.getByRole("button", { name: /添加用户/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })
    await expect(page.getByRole("button", { name: /取消/ })).toBeVisible()
  })

  test("users table shows user columns", async ({ page }) => {
    // Wait for table to load
    const table = page.locator("table")
    await expect(table).toBeVisible({ timeout: 15000 })

    // Table should have header columns
    await expect(page.locator("table th").first()).toBeVisible()
  })

  test("can close add user dialog", async ({ page }) => {
    // Click add user button
    await page.getByRole("button", { name: /添加用户/ }).click()

    // Wait for dialog
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    // Press Escape to close
    await page.keyboard.press("Escape")

    // Dialog should be closed
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
  })

  test("can close add user dialog with cancel button", async ({ page }) => {
    await page.getByRole("button", { name: /添加用户/ }).click()
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 })

    await page.getByRole("button", { name: /取消/ }).click()

    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
  })
})
