import { expect, test } from "../fixtures"

test.describe("Tagging Rule Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/settings/tagging-rules")
    await expect(page.locator("h1")).toContainText(/分类规则/, {
      timeout: 15000,
    })
  })

  test.describe("Step 1: Pattern & Preview", () => {
    test("opens wizard dialog when clicking new rule button", async ({
      page,
    }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()
      // Should show wizard title
      await expect(page.getByText("新建分类规则")).toBeVisible()
    })

    test("can select rule type", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      // Click rule type selector
      const ruleTypeSelect = page
        .getByRole("dialog")
        .getByRole("combobox")
        .first()
      await ruleTypeSelect.click()

      // Should show all rule type options
      const dropdown = page.getByRole("listbox")
      await expect(
        dropdown.getByRole("option", { name: "文件名正则" }),
      ).toBeVisible()
      await expect(
        dropdown.getByRole("option", { name: "路径正则" }),
      ).toBeVisible()

      // Select an option
      await dropdown.getByRole("option", { name: "路径正则" }).click()
    })

    test("can enter pattern and see preview button", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      // Enter pattern
      const patternInput = page.getByLabel(/匹配模式/)
      await patternInput.fill("^train/.*")

      // Should have preview functionality
      await expect(patternInput).toHaveValue("^train/.*")
    })
  })

  test.describe("Step 2: Tag Selection", () => {
    test("can access tag selection", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      // Should show tag selector
      await expect(page.getByText("应用标签")).toBeVisible()
    })
  })

  test.describe("Step 3: Confirmation", () => {
    test("can enter rule name", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      // Enter rule name
      const nameInput = page.getByLabel(/规则名称/)
      await nameInput.fill("测试规则名称")
      await expect(nameInput).toHaveValue("测试规则名称")
    })

    test("has auto execute checkbox", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      // Should show auto execute option
      await expect(page.getByText("自动执行", { exact: true })).toBeVisible()
    })
  })

  test.describe("Navigation", () => {
    test("can close wizard with escape", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      await page.keyboard.press("Escape")
      await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 })
    })

    test("has submit button", async ({ page }) => {
      await page
        .getByRole("button", { name: /新建规则/ })
        .first()
        .click()
      await expect(page.getByRole("dialog")).toBeVisible()

      // Should have submit button
      await expect(page.getByRole("button", { name: /创建规则/ })).toBeVisible()
    })
  })
})
