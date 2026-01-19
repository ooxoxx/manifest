import { test as setup } from "@playwright/test"
import { firstSuperuser, firstSuperuserPassword } from "./config.ts"

const authFile = "playwright/.auth/user.json"

setup("authenticate", async ({ page }) => {
  await page.goto("/login")
  await page.getByTestId("email-input").fill(firstSuperuser)
  await page.getByTestId("password-input").fill(firstSuperuserPassword)
  // Button text is "登录系统" (Chinese for "Login System")
  await page
    .getByRole("button", { name: /登录系统|Access System|Log in/i })
    .click()
  await page.waitForURL("/ops")
  await page.context().storageState({ path: authFile })
})
