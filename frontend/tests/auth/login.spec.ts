import { expect, test } from "../fixtures"
import { firstSuperuser, firstSuperuserPassword } from "../config"

// Login tests need fresh context without stored auth
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Login Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login")
  })

  test("page loads correctly with login form visible", async ({ page }) => {
    await expect(
      page.getByRole("heading", { name: /登录|Login/i }),
    ).toBeVisible()
    await expect(page.getByTestId("email-input")).toBeVisible()
    await expect(page.getByTestId("password-input")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /登录系统|Log in/i }),
    ).toBeVisible()
  })

  test("page shows forgot password link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /忘记密码|Forgot password/i })).toBeVisible()
  })

  test("page shows sign up link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /注册|Sign up/i })).toBeVisible()
  })

  test("clicking sign up link navigates to signup page", async ({ page }) => {
    await page.getByRole("link", { name: /注册|Sign up/i }).click()
    await expect(page).toHaveURL(/signup/)
  })

  test("clicking forgot password link navigates to recover page", async ({ page }) => {
    await page.getByRole("link", { name: /忘记密码|Forgot password/i }).click()
    await expect(page).toHaveURL(/recover/)
  })

  test("valid credentials login successfully redirects to /ops", async ({
    page,
  }) => {
    await page.getByTestId("email-input").fill(firstSuperuser)
    await page.getByTestId("password-input").fill(firstSuperuserPassword)
    await page.getByRole("button", { name: /登录系统|Log in/i }).click()

    await page.waitForURL(/\/(ops)?$/)
    await expect(page).toHaveURL(/\/(ops)?$/)
  })

  test("invalid email format shows validation error", async ({ page }) => {
    await page.getByTestId("email-input").fill("invalid-email")
    await page.getByTestId("password-input").fill("somepassword123")
    await page.getByTestId("email-input").blur()

    // Wait for the specific validation error message
    await expect(page.locator("[data-slot='form-message']").first()).toBeVisible()
  })

  test("wrong password shows authentication error", async ({ page }) => {
    await page.getByTestId("email-input").fill(firstSuperuser)
    await page.getByTestId("password-input").fill("wrongpassword123")
    await page.getByRole("button", { name: /登录系统|Log in/i }).click()

    // Wait for error message to appear
    await expect(
      page.getByText(/密码错误|incorrect|invalid|unauthorized/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test("empty fields submission shows required field errors", async ({
    page,
  }) => {
    // Try to submit without filling fields
    await page.getByRole("button", { name: /登录系统|Log in/i }).click()

    // Form validation should prevent submission and show errors
    await expect(page.getByTestId("email-input")).toBeFocused()
  })

  test("already logged in user accessing /login redirects to home", async ({
    browser,
  }) => {
    // Create context with stored auth
    const context = await browser.newContext({
      storageState: "playwright/.auth/user.json",
    })
    const page = await context.newPage()

    await page.goto("/login")
    // Should redirect to home/ops since already logged in
    await page.waitForURL(/\/(ops)?$/)
    await expect(page).toHaveURL(/\/(ops)?$/)

    await context.close()
  })

  test("email input accepts valid email", async ({ page }) => {
    const emailInput = page.getByTestId("email-input")
    await emailInput.fill("test@example.com")
    await expect(emailInput).toHaveValue("test@example.com")
  })

  test("password input hides characters", async ({ page }) => {
    const passwordInput = page.getByTestId("password-input")
    await expect(passwordInput).toHaveAttribute("type", "password")
  })
})
