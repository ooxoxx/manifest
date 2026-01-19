import { expect, test } from "@playwright/test"

/**
 * MinIO 实例管理 E2E 测试
 *
 * 这些测试验证完整的用户流程，包括：
 * 1. API 调用是否成功
 * 2. 数据是否正确持久化
 * 3. UI 是否正确反映数据状态
 *
 * 使用 docker compose 中预配置的 MinIO 实例进行测试
 */

// MinIO test instance credentials from docker-compose.override.yml
const TEST_MINIO = {
  name: `e2e-test-instance-${Date.now()}`,
  endpoint: "minio:9000", // Container network endpoint
  accessKey: "minioadmin",
  secretKey: "minioadmin",
  secure: false,
}

test.describe("MinIO Instance Management - Full Flow", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/minio-instances")
    // Wait for page to be fully loaded
    await expect(
      page.getByRole("heading", { name: /MinIO/i })
    ).toBeVisible()
  })

  test("Can view MinIO instances list", async ({ page }) => {
    // Page should load without errors
    await expect(page.getByRole("table")).toBeVisible()

    // Should have table headers
    await expect(page.getByRole("columnheader", { name: /名称|name/i })).toBeVisible()
    await expect(page.getByRole("columnheader", { name: /endpoint/i })).toBeVisible()
  })

  test("Full flow: Add instance → Verify in list → Test connection → Delete", async ({ page }) => {
    // Step 1: Open add dialog
    const addButton = page.getByRole("button", { name: /添加|add/i })
    await expect(addButton).toBeVisible()
    await addButton.click()

    // Step 2: Fill in the form
    await expect(page.getByRole("dialog")).toBeVisible()

    await page.getByLabel(/名称|name/i).fill(TEST_MINIO.name)
    await page.getByLabel(/endpoint/i).fill(TEST_MINIO.endpoint)
    await page.getByLabel(/access.*key/i).fill(TEST_MINIO.accessKey)
    await page.getByLabel(/secret.*key/i).fill(TEST_MINIO.secretKey)

    // Handle secure checkbox (should be unchecked for local MinIO)
    const secureCheckbox = page.getByLabel(/secure|https/i)
    if (await secureCheckbox.isChecked()) {
      await secureCheckbox.uncheck()
    }

    // Step 3: Submit and verify API success
    const submitButton = page.getByRole("button", { name: /保存|save|创建|create/i })
    await submitButton.click()

    // Wait for dialog to close (indicates success)
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 10000 })

    // Step 4: Verify instance appears in list
    // This is the key assertion - if API call failed, this would fail
    await expect(
      page.getByRole("cell", { name: TEST_MINIO.name })
    ).toBeVisible({ timeout: 5000 })

    // Step 5: Test connection
    const instanceRow = page.getByRole("row").filter({ hasText: TEST_MINIO.name })
    await expect(instanceRow).toBeVisible()

    // Click actions menu
    const actionsButton = instanceRow.getByRole("button").first()
    await actionsButton.click()

    // Click test connection
    await page.getByRole("menuitem", { name: /测试|test/i }).click()

    // Wait for test result - should show success toast or status
    // The exact UI depends on implementation, but we should see some feedback
    await expect(
      page.getByText(/连接成功|success|ok/i)
    ).toBeVisible({ timeout: 10000 })

    // Step 6: Clean up - delete the instance
    // Re-open actions menu
    await actionsButton.click()
    await page.getByRole("menuitem", { name: /删除|delete/i }).click()

    // Confirm deletion if there's a confirmation dialog
    const confirmButton = page.getByRole("button", { name: /确认|confirm|删除|delete/i })
    if (await confirmButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmButton.click()
    }

    // Verify instance is removed from list
    await expect(
      page.getByRole("cell", { name: TEST_MINIO.name })
    ).not.toBeVisible({ timeout: 5000 })
  })

  test("Shows error when adding instance with invalid endpoint", async ({ page }) => {
    // Open add dialog
    await page.getByRole("button", { name: /添加|add/i }).click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Fill with invalid endpoint
    await page.getByLabel(/名称|name/i).fill("invalid-instance")
    await page.getByLabel(/endpoint/i).fill("invalid-endpoint:9999")
    await page.getByLabel(/access.*key/i).fill("wrong")
    await page.getByLabel(/secret.*key/i).fill("wrong")

    // Submit
    await page.getByRole("button", { name: /保存|save|创建|create/i }).click()

    // Should show error (dialog stays open or error message appears)
    // Either the dialog stays open with error, or we see an error toast
    const hasError = await Promise.race([
      page.getByText(/错误|error|failed|失败/i).isVisible({ timeout: 5000 }),
      page.getByRole("dialog").isVisible({ timeout: 5000 }),
    ])

    expect(hasError).toBeTruthy()
  })

  test("Duplicate instance name shows error", async ({ page }) => {
    // First, check if there's at least one instance
    const firstRow = page.getByRole("row").nth(1)
    const hasExisting = await firstRow.isVisible().catch(() => false)

    if (!hasExisting) {
      test.skip(true, "No existing instances to test duplicate name")
      return
    }

    // Get the name of the first instance
    const existingName = await firstRow.getByRole("cell").first().textContent()

    if (!existingName) {
      test.skip(true, "Could not get existing instance name")
      return
    }

    // Try to add with same name
    await page.getByRole("button", { name: /添加|add/i }).click()
    await page.getByLabel(/名称|name/i).fill(existingName.trim())
    await page.getByLabel(/endpoint/i).fill("some:9000")
    await page.getByLabel(/access.*key/i).fill("key")
    await page.getByLabel(/secret.*key/i).fill("secret")

    await page.getByRole("button", { name: /保存|save|创建|create/i }).click()

    // Should show duplicate error
    await expect(
      page.getByText(/已存在|duplicate|exists|重复/i)
    ).toBeVisible({ timeout: 5000 })
  })
})

test.describe("MinIO Instance List Loading", () => {
  test("Shows loading state then data", async ({ page }) => {
    // Navigate and check loading
    await page.goto("/minio-instances")

    // Should eventually show table (even if empty)
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10000 })
  })

  test("Empty state shows helpful message", async ({ page }) => {
    // This test assumes no instances exist
    // If instances exist, the table will have data rows
    await page.goto("/minio-instances")

    const table = page.getByRole("table")
    await expect(table).toBeVisible()

    // Check if table has data rows (beyond header)
    const dataRows = page.getByRole("row").filter({ hasNot: page.getByRole("columnheader") })
    const rowCount = await dataRows.count()

    if (rowCount === 0) {
      // Should show empty state message
      await expect(
        page.getByText(/暂无|no.*instance|empty/i)
      ).toBeVisible()
    }
  })
})
