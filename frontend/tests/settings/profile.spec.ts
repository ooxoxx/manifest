import { expect, test } from "../fixtures"

test.describe("User Settings / Profile", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings")
    // Wait for user settings page to load with title
    await expect(page.locator("h1")).toContainText(/用户设置/, {
      timeout: 15000,
    })
  })

  test("page loads with user settings title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/用户设置/)
  })

  test("profile tab shows user name field", async ({ page }) => {
    // Should be on my-profile tab by default, showing name label
    // The form has FormLabel with text "姓名"
    await expect(page.getByText("姓名").first()).toBeVisible({ timeout: 10000 })
  })

  test("profile tab shows email field", async ({ page }) => {
    // Should show email label
    await expect(page.getByText("邮箱").first()).toBeVisible({ timeout: 10000 })
  })

  test("profile tab shows edit button by default", async ({ page }) => {
    // Should show edit button (not save - save only appears in edit mode)
    await expect(page.getByRole("button", { name: /编辑/ })).toBeVisible({ timeout: 10000 })
  })

  test("clicking edit button enables form editing", async ({ page }) => {
    // Click edit button
    await page.getByRole("button", { name: /编辑/ }).click()
    // Should now show save button
    await expect(page.getByRole("button", { name: /保存/ })).toBeVisible({ timeout: 5000 })
  })

  test("password tab allows changing password", async ({ page }) => {
    // Click on password tab - the tab text is "密码"
    await page.getByRole("tab", { name: "密码" }).click()

    // Should show password change content - "修改密码" heading
    await expect(page.getByText(/修改密码|更改密码|Change Password/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test("password tab shows current password field", async ({ page }) => {
    await page.getByRole("tab", { name: "密码" }).click()
    await expect(page.getByText("当前密码")).toBeVisible({
      timeout: 10000,
    })
  })

  test("password tab shows new password field", async ({ page }) => {
    await page.getByRole("tab", { name: "密码" }).click()
    await expect(page.getByText("新密码", { exact: true })).toBeVisible({
      timeout: 10000,
    })
  })

  test("password tab shows confirm password field", async ({ page }) => {
    await page.getByRole("tab", { name: "密码" }).click()
    await expect(page.getByText("确认密码")).toBeVisible({
      timeout: 10000,
    })
  })

  test("danger zone tab shows delete account option", async ({ page }) => {
    // Click on danger zone tab
    await page.getByRole("tab", { name: "危险区域" }).click()

    // Should show delete account button
    await expect(page.getByRole("button", { name: /删除/ })).toBeVisible({
      timeout: 10000,
    })
  })

  test("danger zone tab shows delete button", async ({ page }) => {
    await page.getByRole("tab", { name: "危险区域" }).click()
    // Should show delete account button
    await expect(page.getByRole("button", { name: /删除账户/ })).toBeVisible({
      timeout: 10000,
    })
  })

  test("all tabs are visible", async ({ page }) => {
    // Verify all three tabs are present
    await expect(page.getByRole("tab", { name: /我的信息|个人资料/i })).toBeVisible()
    await expect(page.getByRole("tab", { name: "密码" })).toBeVisible()
    await expect(page.getByRole("tab", { name: "危险区域" })).toBeVisible()
  })

  test("can switch between tabs", async ({ page }) => {
    // Start on profile tab
    await expect(page.getByText("姓名").first()).toBeVisible({ timeout: 10000 })

    // Switch to password tab
    await page.getByRole("tab", { name: "密码" }).click()
    await expect(page.getByText("修改密码")).toBeVisible({ timeout: 10000 })

    // Switch to danger zone tab
    await page.getByRole("tab", { name: "危险区域" }).click()
    await expect(page.getByRole("button", { name: /删除/ })).toBeVisible({ timeout: 10000 })

    // Switch back to profile tab
    await page.getByRole("tab", { name: /我的信息|个人资料/i }).click()
    await expect(page.getByText("姓名").first()).toBeVisible({ timeout: 10000 })
  })
})
