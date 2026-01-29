import { expect, test } from "../fixtures"

test.describe("Tagging Rule Wizard Page", () => {
  test("navigates to wizard page when clicking new rule button", async ({
    page,
  }) => {
    await page.goto("/settings/tagging-rules")
    await expect(page.locator("h1")).toContainText(/分类规则/, {
      timeout: 15000,
    })

    await page
      .getByRole("link", { name: /新建规则/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/settings\/tagging-rules\/new/)
  })

  test("shows full page wizard with title", async ({ page }) => {
    await page.goto("/settings/tagging-rules/new")
    await expect(page.getByText("新建分类规则")).toBeVisible({ timeout: 15000 })
  })

  test("can navigate back to list with cancel button", async ({ page }) => {
    await page.goto("/settings/tagging-rules/new")
    await expect(page.getByText("新建分类规则")).toBeVisible({ timeout: 15000 })

    await page.getByRole("button", { name: /取消/ }).click()
    await expect(page).toHaveURL(/\/settings\/tagging-rules$/)
  })

  test.describe("Step 1: Pattern & Preview", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/settings/tagging-rules/new")
      await expect(page.getByText("新建分类规则")).toBeVisible({
        timeout: 15000,
      })
    })

    test("can enter full-path regex pattern", async ({ page }) => {
      // Enter pattern for full-path matching
      const patternInput = page.getByLabel(/匹配模式/)
      await patternInput.fill("test-bucket/train/.*")

      // Should have the value
      await expect(patternInput).toHaveValue("test-bucket/train/.*")
    })

    test("shows help text for full-path matching", async ({ page }) => {
      // Should show help text explaining full-path format
      await expect(
        page.getByText(/bucket\/path\/filename/i).or(page.getByText(/全路径/)),
      ).toBeVisible()
    })
  })

  test.describe("Step 2: Tag Selection", () => {
    test("can access tag selection step", async ({ page }) => {
      await page.goto("/settings/tagging-rules/new")
      await expect(page.getByText("新建分类规则")).toBeVisible({
        timeout: 15000,
      })

      // Fill Step 1 with full-path pattern
      const patternInput = page.getByLabel(/匹配模式/)
      await patternInput.fill(".*")

      // Navigate to Step 2
      await page.getByRole("button", { name: /下一步/ }).click()

      // Should show tag selector label
      await expect(page.getByText("应用标签")).toBeVisible()
      // Should show tag selector button
      await expect(page.getByRole("button", { name: /选择标签/ })).toBeVisible()
    })

    test("can open tag selector popover", async ({ page }) => {
      await page.goto("/settings/tagging-rules/new")
      await expect(page.getByText("新建分类规则")).toBeVisible({
        timeout: 15000,
      })

      // Fill Step 1
      await page.getByLabel(/匹配模式/).fill(".*")
      await page.getByRole("button", { name: /下一步/ }).click()

      // Open tag selector
      await page.getByRole("button", { name: /选择标签/ }).click()

      // Should show search input in popover
      await expect(page.getByPlaceholder("搜索标签...")).toBeVisible()
    })
  })

  test.describe("Navigation", () => {
    test("can navigate back from step 2", async ({ page }) => {
      await page.goto("/settings/tagging-rules/new")
      await expect(page.getByText("新建分类规则")).toBeVisible({
        timeout: 15000,
      })

      // Go to Step 2
      await page.getByLabel(/匹配模式/).fill(".*")
      await page.getByRole("button", { name: /下一步/ }).click()
      await expect(page.getByText("应用标签", { exact: true })).toBeVisible()

      // Go back to Step 1
      await page.getByRole("button", { name: /上一步/ }).click()
      await expect(page.getByLabel(/匹配模式/)).toBeVisible()
    })

    test("shows step indicator", async ({ page }) => {
      await page.goto("/settings/tagging-rules/new")
      await expect(page.getByText("新建分类规则")).toBeVisible({
        timeout: 15000,
      })

      // Should show step numbers in the indicator
      // Step 1 is active, steps 2 and 3 should be visible
      await expect(page.getByText("2", { exact: true })).toBeVisible()
      await expect(page.getByText("3", { exact: true })).toBeVisible()
    })
  })
})
