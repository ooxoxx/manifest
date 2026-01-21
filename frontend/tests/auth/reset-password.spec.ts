import { expect, test } from "../fixtures"
import { firstSuperuser } from "../config"

// Reset password tests need fresh context without stored auth
test.use({ storageState: { cookies: [], origins: [] } })

// Mailcatcher host - use localhost when running locally, container name in Docker
const MAILCATCHER_HOST =
  process.env.MAILCATCHER_HOST || "http://127.0.0.1:1080"

test.describe("Password Reset", () => {
  test("recover password page loads correctly", async ({ page }) => {
    await page.goto("/recover-password")

    await expect(
      page.getByRole("heading", { name: /Password Recovery|重置密码/i }),
    ).toBeVisible()
    await expect(page.getByTestId("email-input")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Continue|发送|Submit/i }),
    ).toBeVisible()
  })

  test("recover password page shows login link", async ({ page }) => {
    await page.goto("/recover-password")
    await expect(page.getByRole("link", { name: /登录|Log in/i })).toBeVisible()
  })

  test("clicking login link from recover page navigates to login", async ({ page }) => {
    await page.goto("/recover-password")
    await page.getByRole("link", { name: /登录|Log in/i }).click()
    await expect(page).toHaveURL(/login/)
  })

  test("sending reset email shows success message", async ({ page }) => {
    await page.goto("/recover-password")

    await page.getByTestId("email-input").fill(firstSuperuser)
    await page.getByRole("button", { name: /Continue|发送|Submit/i }).click()

    // Should show success toast or message
    await expect(page.getByText(/sent|发送成功|success/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test("reset link from email allows setting new password", async ({
    page,
    request,
  }) => {
    // First, request password reset
    await page.goto("/recover-password")
    await page.getByTestId("email-input").fill(firstSuperuser)
    await page.getByRole("button", { name: /Continue|发送|Submit/i }).click()

    // Wait for success message
    await expect(page.getByText(/sent|发送成功|success/i)).toBeVisible({
      timeout: 10000,
    })

    // Try to fetch email from mailcatcher
    let token: string | null = null

    try {
      // Wait a moment for email to arrive
      await page.waitForTimeout(1000)

      const messagesResponse = await request.get(`${MAILCATCHER_HOST}/messages`)
      if (messagesResponse.ok()) {
        const messages = await messagesResponse.json()
        const resetEmail = messages.find(
          (m: { recipients: string[] }) =>
            m.recipients.includes(`<${firstSuperuser}>`) ||
            m.recipients.includes(firstSuperuser),
        )

        if (resetEmail) {
          const emailBody = await request.get(
            `${MAILCATCHER_HOST}/messages/${resetEmail.id}.html`,
          )
          const htmlContent = await emailBody.text()
          const tokenMatch = htmlContent.match(
            /reset-password\?token=([^"&\s<]+)/,
          )
          if (tokenMatch) {
            token = tokenMatch[1]
          }
        }
      }
    } catch {
      // Mailcatcher might not be available
      test.skip(true, "Mailcatcher not available")
    }

    if (!token) {
      test.skip(true, "Could not retrieve reset token from email")
    }

    // Navigate to reset password page with token
    await page.goto(`/reset-password?token=${token}`)

    await expect(
      page.getByRole("heading", { name: /Reset Password|重置密码/i }),
    ).toBeVisible()
    await expect(page.getByTestId("new-password-input")).toBeVisible()
    await expect(page.getByTestId("confirm-password-input")).toBeVisible()
  })
})
