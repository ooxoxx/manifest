import { expect, type Page, test } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"
import { randomPassword } from "./utils/random.ts"

test.use({ storageState: { cookies: [], origins: [] } })

const fillForm = async (page: Page, email: string, password: string) => {
  await page.getByTestId("email-input").fill(email)
  await page.getByTestId("password-input").fill(password)
}

const verifyInput = async (page: Page, testId: string) => {
  const input = page.getByTestId(testId)
  await expect(input).toBeVisible()
  await expect(input).toHaveText("")
  await expect(input).toBeEditable()
}

test("Inputs are visible, empty and editable", async ({ page }) => {
  await page.goto("/login")

  await verifyInput(page, "email-input")
  await verifyInput(page, "password-input")
})

test("Log In button is visible", async ({ page }) => {
  await page.goto("/login")

  await expect(
    page.getByRole("button", { name: /登录系统|Log In/i }),
  ).toBeVisible()
})

test("Forgot Password link is visible", async ({ page }) => {
  await page.goto("/login")

  await expect(
    page.getByRole("link", { name: /忘记密码|Forgot/i }),
  ).toBeVisible()
})

test("Log in with valid email and password ", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuser, firstSuperuserPassword)
  await page.getByRole("button", { name: /登录系统|Log In/i }).click()

  await page.waitForURL("/ops")

  await expect(page.getByText(/运维中心|Ops Center/i)).toBeVisible()
})

test("Log in with invalid email", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, "invalidemail", firstSuperuserPassword)
  // Trigger validation by clicking elsewhere or submitting
  await page.getByRole("button", { name: /登录系统|Log In/i }).click()

  // Zod default email validation message is "Invalid input"
  await expect(page.getByText("Invalid input")).toBeVisible()
})

test("Log in with invalid password", async ({ page }) => {
  const password = randomPassword()

  await page.goto("/login")
  await fillForm(page, firstSuperuser, password)
  await page.getByRole("button", { name: /登录系统|Log In/i }).click()

  await expect(
    page.getByText(/邮箱或密码错误|Incorrect email or password/i),
  ).toBeVisible()
})

// Log out

test("Successful log out", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuser, firstSuperuserPassword)
  await page.getByRole("button", { name: /登录系统|Log In/i }).click()

  await page.waitForURL("/")

  await expect(page.getByText(/欢迎回来|Welcome back/i)).toBeVisible()

  await page.getByTestId("user-menu").click()
  await page.getByRole("menuitem", { name: /退出登录|Log out/i }).click()
  await page.waitForURL("/login")
})

test("Logged-out user cannot access protected routes", async ({ page }) => {
  await page.goto("/login")

  await fillForm(page, firstSuperuser, firstSuperuserPassword)
  await page.getByRole("button", { name: /登录系统|Log In/i }).click()

  await page.waitForURL("/")

  await expect(page.getByText(/欢迎回来|Welcome back/i)).toBeVisible()

  await page.getByTestId("user-menu").click()
  await page.getByRole("menuitem", { name: /退出登录|Log out/i }).click()
  await page.waitForURL("/login")

  await page.goto("/settings")
  await page.waitForURL("/login")
})

test("Redirects to /login when token is wrong", async ({ page }) => {
  await page.goto("/settings")
  await page.evaluate(() => {
    localStorage.setItem("access_token", "invalid_token")
  })
  await page.goto("/settings")
  await page.waitForURL("/login")
  await expect(page).toHaveURL("/login")
})
