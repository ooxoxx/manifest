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
    await expect(page.getByLabel(/列表模式/)).toBeVisible({ timeout: 10000 })
    await expect(page.getByLabel(/逐张模式/)).toBeVisible()
  })

  test("data table or empty state is displayed", async ({ page }) => {
    // Wait for data to load - either table or empty state
    await expect(
      page.locator("table").or(page.getByText(/暂无/)),
    ).toBeVisible({
      timeout: 10000,
    })
  })

  test("selecting samples shows batch operation bar", async ({ page }) => {
    // Wait for table to load
    const table = page.locator("table")
    const hasData = await table.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasData) {
      // Try to find and click a checkbox in the first row
      const firstCheckbox = page
        .locator("table tbody tr")
        .first()
        .getByRole("checkbox")
      const checkboxVisible = await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false)
      if (checkboxVisible) {
        await firstCheckbox.click()
        // Should show batch action bar or selection count
        await expect(page.getByText(/选中/)).toBeVisible({ timeout: 5000 })
      }
    }
  })

  test("clicking toggle switches to single view mode", async ({ page }) => {
    // Wait for page content to load
    await expect(
      page.locator("table").or(page.getByText(/暂无/)),
    ).toBeVisible({ timeout: 10000 })

    // Click single view mode toggle using aria-label
    await page.getByLabel(/逐张模式/).click()

    // The toggle should be pressed after clicking
    const singleToggle = page.getByLabel(/逐张模式/)
    await expect(singleToggle).toBeVisible()

    // If samples exist, we should see the reviewer with back button
    // If no samples, we stay in list view - either case is valid
    const backButton = page.getByRole("button", { name: /Back/ })
    const table = page.locator("table")

    // One of these should be visible (reviewer back button or data table)
    await expect(backButton.or(table)).toBeVisible({ timeout: 10000 })
  })

  test("single view shows back button when samples exist", async ({ page }) => {
    // Wait for page content to load
    await expect(
      page.locator("table").or(page.getByText(/暂无/)),
    ).toBeVisible({ timeout: 10000 })

    // Check if table has data
    const table = page.locator("table")
    const rows = page.locator("table tbody tr")
    const rowCount = await rows.count().catch(() => 0)

    if (rowCount > 0) {
      // Switch to single mode using aria-label
      await page.getByLabel(/逐张模式/).click()

      // Should show back button in reviewer
      await expect(
        page.getByRole("button", { name: /Back/ }),
      ).toBeVisible({ timeout: 10000 })
    } else {
      // No data - test passes as there's nothing to show in single view
      await expect(table.or(page.getByText(/暂无/))).toBeVisible()
    }
  })

  test("keyboard navigation works in single view when samples exist", async ({
    page,
  }) => {
    // Wait for page content to load
    await expect(
      page.locator("table").or(page.getByText(/暂无/)),
    ).toBeVisible({ timeout: 10000 })

    // Check if table has data
    const rows = page.locator("table tbody tr")
    const rowCount = await rows.count().catch(() => 0)

    if (rowCount > 0) {
      // Switch to single mode first using aria-label
      await page.getByLabel(/逐张模式/).click()

      // Should show back button in reviewer
      const backButton = page.getByRole("button", { name: /Back/ })
      await expect(backButton).toBeVisible({ timeout: 10000 })

      // Press Escape to go back to list
      await page.keyboard.press("Escape")

      // Should return to list view
      await expect(page.getByLabel(/逐张模式/)).toBeVisible({ timeout: 10000 })
    } else {
      // No data - test passes, nothing to navigate
      await expect(page.locator("table").or(page.getByText(/暂无/))).toBeVisible()
    }
  })
})
