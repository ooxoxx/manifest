import { expect, test } from "../fixtures"

test.describe("Ops Center", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/ops")
    // Wait for page to load - check for h1 with ops center title
    await expect(page.locator("h1")).toContainText(/运维中心/, {
      timeout: 15000,
    })
  })

  test("page loads correctly with ops center title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/运维中心/)
  })

  test("stats cards are visible", async ({ page }) => {
    // Check for stats cards by their title text using exact match
    await expect(page.getByText("样本总量")).toBeVisible()
    await expect(page.getByText("数据集", { exact: true })).toBeVisible()
    await expect(page.getByText("本周新增")).toBeVisible()
    await expect(page.getByText("存储实例")).toBeVisible()
  })

  test("time range selector is available", async ({ page }) => {
    // Find time range selector
    const selector = page.getByRole("combobox")
    await expect(selector).toBeVisible()

    // Click to open dropdown
    await selector.click()

    // Check options are available
    await expect(page.getByRole("option", { name: "今日" })).toBeVisible()
    await expect(page.getByRole("option", { name: "本周" })).toBeVisible()
    await expect(page.getByRole("option", { name: "本月" })).toBeVisible()
  })

  test("can change time range to today", async ({ page }) => {
    const selector = page.getByRole("combobox")
    await selector.click()
    await page.getByRole("option", { name: "今日" }).click()
    await expect(selector).toContainText("今日")
  })

  test("can change time range to month", async ({ page }) => {
    const selector = page.getByRole("combobox")
    await selector.click()
    await page.getByRole("option", { name: "本月" }).click()
    await expect(selector).toContainText("本月")
  })

  test("sample growth trend chart area is visible", async ({ page }) => {
    await expect(page.getByText("样本增长趋势")).toBeVisible()
  })

  test("tag distribution chart area is visible", async ({ page }) => {
    await expect(page.getByText("标签分布 Top 10")).toBeVisible()
  })

  test("annotation status section is visible", async ({ page }) => {
    await expect(page.getByText("标注状态分布")).toBeVisible()
    await expect(page.getByText("已标注")).toBeVisible()
    await expect(page.getByText("无标注")).toBeVisible()
  })

  test("system status section is visible", async ({ page }) => {
    await expect(page.getByText("系统状态")).toBeVisible()
    await expect(page.getByText("导入任务")).toBeVisible()
    await expect(page.getByText("标注冲突")).toBeVisible()
    await expect(page.getByText("系统运行正常")).toBeVisible()
  })

  test("stats cards section is interactive", async ({ page }) => {
    // Verify the stats section is rendered
    const statsSection = page.locator(".grid").first()
    await expect(statsSection).toBeVisible()
  })
})
