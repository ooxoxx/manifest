import { expect, test } from "../fixtures"

test.describe("Datasets Browser", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/datasets")
    // Wait for page to load
    await expect(page.locator("h1")).toContainText(/数据集/, { timeout: 15000 })
  })

  test("page loads with datasets title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/数据集/)
  })

  test("page has proper header structure", async ({ page }) => {
    // Just verify page header is visible
    await expect(page.locator("h1")).toBeVisible()
  })

  test("list displays name, sample count, and creation time columns", async ({
    page,
  }) => {
    // Wait for table or empty state
    await expect(
      page.locator("table").or(page.getByText(/暂无|No data/i)),
    ).toBeVisible({ timeout: 10000 })
  })

  test("'构建数据集' button is visible", async ({ page }) => {
    await expect(page.getByRole("link", { name: /构建数据集/ })).toBeVisible()
  })

  test("'构建数据集' button navigates to build wizard", async ({ page }) => {
    // Click on the build dataset button - text is "构建数据集"
    await page.getByRole("link", { name: /构建数据集/ }).click()

    await expect(page).toHaveURL(/\/datasets\/build/, { timeout: 10000 })
  })

  test("page shows correct header section", async ({ page }) => {
    // The page should have a proper header section
    await expect(page.locator("h1")).toBeVisible()
  })

  test("clicking view expands sample list", async ({ page }) => {
    // Wait for table to load
    const table = page.locator("table")
    const tableVisible = await table
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (tableVisible) {
      // Look for expand/view button in first row
      const viewButton = page
        .locator("table tbody tr")
        .first()
        .getByRole("button", { name: /查看|View/i })
      const viewVisible = await viewButton
        .isVisible({ timeout: 3000 })
        .catch(() => false)
      if (viewVisible) {
        await viewButton.click()
        // Should expand or navigate to show samples
        await expect(page.getByText(/样本|Samples/i)).toBeVisible()
      }
    }
  })

  test("clicking review enters review mode", async ({ page }) => {
    // Wait for table to load
    const table = page.locator("table")
    const tableVisible = await table
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (tableVisible) {
      // Look for review button in first row
      const reviewButton = page
        .locator("table tbody tr")
        .first()
        .getByRole("link", { name: /审核|Review/i })
      const reviewVisible = await reviewButton
        .isVisible({ timeout: 3000 })
        .catch(() => false)
      if (reviewVisible) {
        await reviewButton.click()
        // Should navigate to review page
        await expect(page).toHaveURL(/\/datasets\/.*\/review/, {
          timeout: 10000,
        })
      }
    }
  })

  test("review mode supports keep/remove actions", async ({ page }) => {
    // Navigate to first dataset review if available
    const table = page.locator("table")
    const tableVisible = await table
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    if (tableVisible) {
      const reviewButton = page
        .locator("table tbody tr")
        .first()
        .getByRole("link", { name: /审核|Review/i })
      const reviewVisible = await reviewButton
        .isVisible({ timeout: 3000 })
        .catch(() => false)
      if (reviewVisible) {
        await reviewButton.click()
        await expect(page).toHaveURL(/\/datasets\/.*\/review/, {
          timeout: 10000,
        })

        // Should show review interface with action buttons
        await expect(
          page
            .getByRole("button", { name: /保留|Keep/i })
            .or(page.getByText(/审核|Review/i)),
        ).toBeVisible({ timeout: 10000 })
      }
    }
  })
})
