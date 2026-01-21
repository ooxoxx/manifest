import { expect, test } from "../fixtures"
import { firstSuperuser } from "../config"
import { randomEmail, randomPassword } from "../utils/random"

// Sign-up tests need fresh context without stored auth
test.use({ storageState: { cookies: [], origins: [] } })

test.describe("Sign Up Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/signup")
  })

  test("page loads correctly with registration form visible", async ({
    page,
  }) => {
    await expect(
      page.getByRole("heading", { name: /创建账户|Sign Up|Register/i }),
    ).toBeVisible()
    await expect(page.getByTestId("full-name-input")).toBeVisible()
    await expect(page.getByTestId("email-input")).toBeVisible()
    await expect(page.getByTestId("password-input")).toBeVisible()
    await expect(page.getByTestId("confirm-password-input")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /注册|Sign Up/i }),
    ).toBeVisible()
  })

  test("page shows login link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /登录|Log in/i })).toBeVisible()
  })

  test("clicking login link navigates to login page", async ({ page }) => {
    await page.getByRole("link", { name: /登录|Log in/i }).click()
    await expect(page).toHaveURL(/login/)
  })

  test("valid registration completes successfully", async ({ page }) => {
    const email = randomEmail()
    const password = randomPassword()

    await page.getByTestId("full-name-input").fill("Test User")
    await page.getByTestId("email-input").fill(email)
    await page.getByTestId("password-input").fill(password)
    await page.getByTestId("confirm-password-input").fill(password)
    await page.getByRole("button", { name: /注册|Sign Up/i }).click()

    // Should show success or redirect to login
    await expect(
      page
        .getByText(/成功|success|registered/i)
        .or(page.getByRole("heading", { name: /登录|Login/i })),
    ).toBeVisible({ timeout: 10000 })
  })

  test("duplicate email shows error", async ({ page }) => {
    // Use the existing superuser email
    await page.getByTestId("full-name-input").fill("Test User")
    await page.getByTestId("email-input").fill(firstSuperuser)
    await page.getByTestId("password-input").fill("validpassword123")
    await page.getByTestId("confirm-password-input").fill("validpassword123")
    await page.getByRole("button", { name: /注册|Sign Up/i }).click()

    // Should show error about existing email
    await expect(
      page.getByText(/已存在|already exists|registered|duplicate/i),
    ).toBeVisible({ timeout: 10000 })
  })

  test("password mismatch shows error", async ({ page }) => {
    await page.getByTestId("full-name-input").fill("Test User")
    await page.getByTestId("email-input").fill(randomEmail())
    await page.getByTestId("password-input").fill("password123")
    await page.getByTestId("confirm-password-input").fill("differentpassword")
    await page.getByTestId("confirm-password-input").blur()

    // Should show password mismatch error
    await expect(page.getByText(/不一致|don't match|mismatch/i)).toBeVisible()
  })

  test("weak password shows error", async ({ page }) => {
    await page.getByTestId("full-name-input").fill("Test User")
    await page.getByTestId("email-input").fill(randomEmail())
    await page.getByTestId("password-input").fill("short")
    // Trigger blur to show validation error
    await page.getByTestId("confirm-password-input").focus()

    // Should show password strength error (min 8 characters)
    // The message is "密码至少需要 8 个字符"
    await expect(
      page.getByText(/密码至少需要|至少.*8|8.*字符/i),
    ).toBeVisible({ timeout: 5000 })
  })

  test("full name input accepts value", async ({ page }) => {
    const nameInput = page.getByTestId("full-name-input")
    await nameInput.fill("John Doe")
    await expect(nameInput).toHaveValue("John Doe")
  })

  test("email validation rejects invalid email", async ({ page }) => {
    await page.getByTestId("email-input").fill("invalid-email")
    await page.getByTestId("password-input").focus()
    // Should show email validation error
    await expect(page.locator("[data-slot='form-message']")).toBeVisible()
  })
})
