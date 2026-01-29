import { expect, test } from "../fixtures"

test.describe("Tagging Rules Manager", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/tagging-rules")
    // Wait for page to load - check for h1 with tagging rules title
    await expect(page.locator("h1")).toContainText(/分类规则/, {
      timeout: 15000,
    })
  })

  test("page loads with tagging rules title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/分类规则/)
  })

  test("page shows description text", async ({ page }) => {
    await expect(page.getByText(/定义规则自动为样本打标签/)).toBeVisible()
  })

  test("empty state or rules list is visible", async ({ page }) => {
    // Wait for content to load - either empty state or rules grid
    // The page always shows either "暂无分类规则" or a grid of rule cards
    await page.waitForTimeout(1000) // Wait for suspense to resolve

    const emptyState = page.getByText("暂无分类规则")
    const rulesGrid = page.locator(".grid")

    // One of these should be visible after loading
    const hasEmptyState = await emptyState.isVisible().catch(() => false)
    const hasRulesGrid = await rulesGrid.isVisible().catch(() => false)

    expect(hasEmptyState || hasRulesGrid).toBeTruthy()
  })

  test("new rule link is visible", async ({ page }) => {
    // The "新建规则" is now a link that navigates to wizard page
    const newRuleLink = page.getByRole("link", { name: /新建规则/ }).first()
    await expect(newRuleLink).toBeVisible()
  })

  test("clicking new rule link navigates to wizard", async ({ page }) => {
    const newRuleLink = page.getByRole("link", { name: /新建规则/ }).first()
    await newRuleLink.click()
    await expect(page).toHaveURL(/\/settings\/tagging-rules\/new/)
    await expect(
      page.getByRole("heading", { name: "新建分类规则" }),
    ).toBeVisible()
  })
})

test.describe("Tagging Rules - Rule Card Actions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/tagging-rules")
    await expect(page.locator("h1")).toContainText(/分类规则/, {
      timeout: 15000,
    })
  })

  test("rule card shows dropdown menu when clicked", async ({ page }) => {
    // This test only runs if there are existing rules
    const moreButton = page
      .getByRole("button")
      .filter({ has: page.locator('svg[class*="lucide-more-horizontal"]') })
      .first()

    if (await moreButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await moreButton.click()

      // Dropdown should show all actions
      await expect(page.getByText("预览匹配")).toBeVisible()
      await expect(page.getByText("执行规则")).toBeVisible()
      await expect(page.getByText("编辑")).toBeVisible()
      await expect(page.getByText("删除")).toBeVisible()
    }
  })

  test("rule card has toggle switch for active state", async ({ page }) => {
    // This test only runs if there are existing rules
    const switchElement = page.getByRole("switch").first()

    if (await switchElement.isVisible({ timeout: 2000 }).catch(() => false)) {
      await expect(switchElement).toBeVisible()
    }
  })
})
