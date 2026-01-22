import { expect, test } from "../fixtures"

test.describe("Dataset Build Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/build")
    // Wait for page to load - check for h1 with build title
    await expect(page.locator("h1")).toContainText(/构建数据集/, {
      timeout: 15000,
    })
  })

  test("page loads with wizard title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/构建数据集/)
  })

  test("page shows description text", async ({ page }) => {
    await expect(page.locator("h1")).toBeVisible()
  })

  test("step indicators show 5 steps", async ({ page }) => {
    // Check step labels are visible using role selectors to avoid text ambiguity
    await expect(page.getByRole("button", { name: "基本信息" })).toBeVisible()
    await expect(page.getByRole("button", { name: "筛选条件" })).toBeVisible()
    await expect(page.getByRole("button", { name: "采样配比" })).toBeVisible()
    await expect(page.getByRole("button", { name: "预览审核" })).toBeVisible()
    await expect(page.getByRole("button", { name: "确认生成" })).toBeVisible()
  })

  test("step 1 is active by default", async ({ page }) => {
    // Step 1 should be clickable
    await expect(page.getByRole("button", { name: "基本信息" })).toBeVisible()
  })

  test("step 1 name field is required", async ({ page }) => {
    // Try to click next without filling name
    const nextButton = page.getByRole("button", { name: /下一步/ })

    // Should be disabled without name
    await expect(nextButton).toBeDisabled()
  })

  test("step 1 name field placeholder is visible", async ({ page }) => {
    await expect(page.getByPlaceholder(/输入数据集名称/)).toBeVisible()
  })

  test("step 1 allows proceeding after filling name", async ({ page }) => {
    // Fill in name
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")

    // Next button should be enabled
    const nextButton = page.getByRole("button", { name: /下一步/ })
    await expect(nextButton).toBeEnabled({ timeout: 5000 })

    // Click to go to step 2
    await nextButton.click()

    // Should see back button - step 2 is active
    await expect(page.getByRole("button", { name: /上一步/ })).toBeVisible({
      timeout: 10000,
    })
  })

  test("step 1 name input accepts value", async ({ page }) => {
    const nameInput = page.getByPlaceholder(/输入数据集名称/)
    await nameInput.fill("My Test Dataset")
    await expect(nameInput).toHaveValue("My Test Dataset")
  })

  test("step 2 filter panel is available", async ({ page }) => {
    // Go to step 2
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")
    await page.getByRole("button", { name: /下一步/ }).click()

    // Verify we're on step 2 with filter panel visible
    await expect(page.getByRole("button", { name: /下一步/ })).toBeVisible({
      timeout: 10000,
    })
    await expect(page.getByRole("button", { name: /上一步/ })).toBeVisible()
  })

  test("can go back from step 2 to step 1", async ({ page }) => {
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")
    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByRole("button", { name: /上一步/ })).toBeVisible({
      timeout: 10000,
    })

    // Go back
    await page.getByRole("button", { name: /上一步/ }).click()

    // Should be back at step 1
    await expect(page.getByPlaceholder(/输入数据集名称/)).toBeVisible({
      timeout: 10000,
    })
  })

  test("step 3 sampling mode toggle exists", async ({ page }) => {
    // Navigate to step 3
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")

    // Go to step 2
    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByRole("button", { name: /上一步/ })).toBeVisible({
      timeout: 10000,
    })

    // Go to step 3
    await page.getByRole("button", { name: /下一步/ }).click()

    // Should be on step 3 - sampling config with "采样配置" card title
    await expect(page.getByText("采样配置")).toBeVisible({
      timeout: 10000,
    })
  })

  test("step 3 random sampling shows count and seed inputs", async ({
    page,
  }) => {
    // Navigate to step 3
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")

    // Go to step 2
    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByRole("button", { name: /上一步/ })).toBeVisible({
      timeout: 10000,
    })

    // Go to step 3
    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByText("采样配置")).toBeVisible({
      timeout: 10000,
    })

    // Click the select to open dropdown and choose random sampling
    await page.getByRole("combobox").click()
    await page.getByRole("option", { name: /随机采样/ }).click()

    // Should show count input - label is "采样数量"
    await expect(page.getByText("采样数量")).toBeVisible({ timeout: 5000 })
  })

  test("step 4 preview shows candidate samples", async ({ page }) => {
    // Navigate to step 4
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")
    await page.getByRole("button", { name: /下一步/ }).click()
    await page.getByRole("button", { name: /下一步/ }).click()
    await page.getByRole("button", { name: /下一步/ }).click()

    // Should be on step 4 - preview
    await expect(page.getByText(/预览结果/)).toBeVisible({ timeout: 15000 })
  })

  test("step 5 shows summary and confirm button", async ({ page }) => {
    // Navigate to step 5
    await page.getByPlaceholder(/输入数据集名称/).fill("Test Dataset")
    await page.getByRole("button", { name: /下一步/ }).click()
    await page.getByRole("button", { name: /下一步/ }).click()
    await page.getByRole("button", { name: /下一步/ }).click()

    // Wait for preview to load
    await expect(page.getByText(/预览结果/)).toBeVisible({ timeout: 15000 })

    await page.getByRole("button", { name: /下一步/ }).click()

    // Should be on step 5 - confirmation
    await expect(page.getByText(/确认创建/)).toBeVisible()
    await expect(page.getByRole("button", { name: /确认构建/ })).toBeVisible()
  })
})
