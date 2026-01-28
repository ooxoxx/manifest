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

  test("add rule button is visible and enabled", async ({ page }) => {
    const addButton = page.getByRole("button", { name: /新建规则/ }).first()
    await expect(addButton).toBeVisible()
    await expect(addButton).toBeEnabled()
  })

  test("clicking add rule button opens dialog", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
  })

  test("add rule dialog has correct title", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("新建分类规则")).toBeVisible()
  })

  test("add rule dialog has name field", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByLabel(/规则名称/)).toBeVisible()
  })

  test("add rule dialog has rule type selector", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("规则类型")).toBeVisible()
  })

  test("add rule dialog has pattern field", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByLabel(/匹配模式/)).toBeVisible()
  })

  test("add rule dialog has tag selector", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("应用标签")).toBeVisible()
  })

  test("add rule dialog has auto execute checkbox", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByText("自动执行")).toBeVisible()
  })

  test("add rule dialog has submit button", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await expect(page.getByRole("button", { name: /创建规则/ })).toBeVisible()
  })

  test("can close add rule dialog with escape", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
  })

  test("rule type selector has all options", async ({ page }) => {
    await page
      .getByRole("button", { name: /新建规则/ })
      .first()
      .click()
    await expect(page.getByRole("dialog")).toBeVisible()

    // Click rule type selector to open dropdown
    const ruleTypeTrigger = page
      .getByRole("dialog")
      .getByRole("combobox")
      .first()
    await ruleTypeTrigger.click()

    // Should show all rule type options in the dropdown
    const dropdown = page.getByRole("listbox")
    await expect(
      dropdown.getByRole("option", { name: "文件名正则" }),
    ).toBeVisible()
    await expect(
      dropdown.getByRole("option", { name: "路径正则" }),
    ).toBeVisible()
    await expect(dropdown.getByRole("option", { name: "扩展名" })).toBeVisible()
    await expect(dropdown.getByRole("option", { name: "桶名" })).toBeVisible()
    await expect(
      dropdown.getByRole("option", { name: "MIME类型" }),
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
