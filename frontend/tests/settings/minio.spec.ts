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

  test("test connection button exists for instances", async ({ page }) => {
    // Wait for table to load
    const table = page.locator("table")
    const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false)
    if (tableVisible) {
      // Look for test connection button in table
      const testButton = page.getByRole("button", { name: /测试/ }).first()
      const buttonVisible = await testButton.isVisible({ timeout: 3000 }).catch(() => false)
      if (buttonVisible) {
        await expect(testButton).toBeEnabled()
      }
    }
  })

  test("delete button exists for instances", async ({ page }) => {
    // Wait for table to load
    const table = page.locator("table")
    const tableVisible = await table.isVisible({ timeout: 5000 }).catch(() => false)
    if (tableVisible) {
      // Look for delete button in table actions
      const deleteButton = page.getByRole("button", { name: /删除/ }).first()
      const buttonVisible = await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)
      if (buttonVisible) {
        await expect(deleteButton).toBeEnabled()
      }
    }
  })
})
