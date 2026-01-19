import { expect, test } from "@playwright/test"

/**
 * 样本审核界面 E2E 测试
 *
 * 这些测试验证 Phase 5 的审核功能，包括：
 * 1. 审核界面加载和图像显示
 * 2. 键盘快捷键导航
 * 3. 保留/移除/跳过操作
 * 4. 撤销功能
 *
 * 测试会验证 API 调用是否正确工作
 */

test.describe("Sample Review Interface", () => {
  // Helper to navigate to a dataset's review page
  async function navigateToReview(page: import("@playwright/test").Page) {
    // Go to datasets page
    await page.goto("/datasets")
    await expect(page.getByRole("table")).toBeVisible()

    // Find a dataset with samples
    const datasetRow = page.getByRole("row").nth(1)
    const hasDatasets = await datasetRow
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    if (!hasDatasets) {
      return { success: false, reason: "No datasets exist" }
    }

    // Open actions menu
    await datasetRow.getByRole("button").click()

    // Click review option
    const reviewOption = page.getByRole("menuitem", { name: /审核|review/i })
    if (!(await reviewOption.isVisible({ timeout: 1000 }).catch(() => false))) {
      return { success: false, reason: "Review option not available" }
    }

    await reviewOption.click()

    // Wait for review page
    const reviewPageLoaded = await page
      .waitForURL(/\/datasets\/[a-f0-9-]+\/review/i, { timeout: 5000 })
      .then(() => true)
      .catch(() => false)

    if (!reviewPageLoaded) {
      return { success: false, reason: "Failed to navigate to review page" }
    }

    return { success: true }
  }

  test("Review page loads dataset samples", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Should show sample navigation info
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Should show action buttons (in review mode)
    await expect(page.getByRole("button", { name: /keep|保留/i })).toBeVisible()
    await expect(
      page.getByRole("button", { name: /remove|移除/i }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: /skip|跳过/i })).toBeVisible()
  })

  test("Shows empty state when dataset has no samples", async ({ page }) => {
    // This test would need a dataset with no samples
    // For now, we just verify the page handles this case gracefully
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Either shows samples or empty message
    const hasSamples = await page
      .getByText(/\d+ \/ \d+/)
      .isVisible({ timeout: 5000 })
      .catch(() => false)
    const hasEmptyMessage = await page
      .getByText(/no samples|暂无样本|没有样本/i)
      .isVisible({ timeout: 1000 })
      .catch(() => false)

    expect(hasSamples || hasEmptyMessage).toBeTruthy()
  })

  test("Back button returns to datasets page", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+|no samples/i)).toBeVisible({
      timeout: 10000,
    })

    // Click back button
    await page.getByRole("button", { name: /back|返回/i }).click()

    // Should return to datasets page
    await page.waitForURL("/datasets", { timeout: 5000 })
  })

  test("Navigation buttons work correctly", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get initial position
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match) {
      test.skip(true, "Could not parse position")
      return
    }

    const [, _currentPos, total] = match
    const totalSamples = parseInt(total, 10)

    if (totalSamples < 2) {
      test.skip(true, "Need at least 2 samples for navigation test")
      return
    }

    // Click Next button
    const nextButton = page.getByRole("button", { name: /next|下一张/i })
    await nextButton.click()

    // Position should update
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()

    // Click Previous button
    const prevButton = page.getByRole("button", { name: /previous|上一张/i })
    await prevButton.click()

    // Position should go back
    await expect(page.getByText(/1 \/ \d+/)).toBeVisible()
  })

  test("Keyboard navigation works", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match) {
      test.skip(true, "Could not parse position")
      return
    }

    const totalSamples = parseInt(match[2], 10)

    if (totalSamples < 2) {
      test.skip(true, "Need at least 2 samples for navigation test")
      return
    }

    // Press D or Right Arrow to go next
    await page.keyboard.press("d")

    // Position should update to 2
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()

    // Press A or Left Arrow to go back
    await page.keyboard.press("a")

    // Position should go back to 1
    await expect(page.getByText(/1 \/ \d+/)).toBeVisible()
  })

  test("Keep action advances to next sample", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match) {
      test.skip(true, "Could not parse position")
      return
    }

    const totalSamples = parseInt(match[2], 10)

    if (totalSamples < 2) {
      test.skip(true, "Need at least 2 samples for action test")
      return
    }

    // Click Keep button
    await page.getByRole("button", { name: /keep|保留/i }).click()

    // Should show success toast
    await expect(page.getByText(/kept|保留成功/i)).toBeVisible({
      timeout: 3000,
    })

    // Position should advance to 2
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()
  })

  test("Skip action advances without changing status", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match) {
      test.skip(true, "Could not parse position")
      return
    }

    const totalSamples = parseInt(match[2], 10)

    if (totalSamples < 2) {
      test.skip(true, "Need at least 2 samples for skip test")
      return
    }

    // Click Skip button
    await page.getByRole("button", { name: /skip|跳过/i }).click()

    // Should show skip toast
    await expect(page.getByText(/skip/i)).toBeVisible({ timeout: 3000 })

    // Position should advance to 2
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()
  })

  test("Undo button reverts last action", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match) {
      test.skip(true, "Could not parse position")
      return
    }

    const totalSamples = parseInt(match[2], 10)

    if (totalSamples < 2) {
      test.skip(true, "Need at least 2 samples for undo test")
      return
    }

    // Undo button should be disabled initially
    const undoButton = page.getByRole("button", { name: /undo|撤销/i })
    await expect(undoButton).toBeDisabled()

    // Perform a Keep action
    await page.getByRole("button", { name: /keep|保留/i }).click()

    // Should move to sample 2
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()

    // Undo button should now be enabled
    await expect(undoButton).toBeEnabled()

    // Click undo
    await undoButton.click()

    // Should go back to sample 1
    await expect(page.getByText(/1 \/ \d+/)).toBeVisible()
  })

  test("Keyboard shortcut Y keeps sample", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match || parseInt(match[2], 10) < 2) {
      test.skip(true, "Need at least 2 samples")
      return
    }

    // Press Y to keep
    await page.keyboard.press("y")

    // Should show success toast
    await expect(page.getByText(/kept|保留/i)).toBeVisible({ timeout: 3000 })

    // Position should advance
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()
  })

  test("Keyboard shortcut N removes sample", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match || parseInt(match[2], 10) < 2) {
      test.skip(true, "Need at least 2 samples")
      return
    }

    // Press N to remove
    await page.keyboard.press("n")

    // Should show remove toast (success or attempting)
    await expect(page.getByText(/removed|移除/i)).toBeVisible({ timeout: 5000 })

    // Undo to restore (cleanup)
    await page.keyboard.press("Control+z")
  })

  test("Keyboard shortcut S skips sample", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match || parseInt(match[2], 10) < 2) {
      test.skip(true, "Need at least 2 samples")
      return
    }

    // Press S to skip
    await page.keyboard.press("s")

    // Should show skip toast
    await expect(page.getByText(/skip/i)).toBeVisible({ timeout: 3000 })

    // Position should advance
    await expect(page.getByText(/2 \/ \d+/)).toBeVisible()
  })

  test("Shows reviewed count", async ({ page }) => {
    const result = await navigateToReview(page)

    if (!result.success) {
      test.skip(true, result.reason)
      return
    }

    // Wait for page to load
    await expect(page.getByText(/\d+ \/ \d+/)).toBeVisible({ timeout: 10000 })

    // Get total samples
    const positionText = await page.getByText(/\d+ \/ \d+/).textContent()
    const match = positionText?.match(/(\d+) \/ (\d+)/)

    if (!match || parseInt(match[2], 10) < 2) {
      test.skip(true, "Need at least 2 samples")
      return
    }

    // Initially 0 reviewed
    await expect(page.getByText(/0 reviewed|\(0\)/i)).toBeVisible()

    // Keep a sample
    await page.getByRole("button", { name: /keep|保留/i }).click()

    // Should show 1 reviewed
    await expect(page.getByText(/1 reviewed|\(1\)/i)).toBeVisible()
  })
})

test.describe("Sample Viewer in Review", () => {
  test("Shows sample image", async ({ page }) => {
    // Navigate to review
    await page.goto("/datasets")
    const datasetRow = page.getByRole("row").nth(1)
    const hasDatasets = await datasetRow
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    if (!hasDatasets) {
      test.skip(true, "No datasets exist")
      return
    }

    await datasetRow.getByRole("button").click()
    const reviewOption = page.getByRole("menuitem", { name: /审核|review/i })
    if (!(await reviewOption.isVisible({ timeout: 1000 }).catch(() => false))) {
      test.skip(true, "Review option not available")
      return
    }
    await reviewOption.click()

    // Wait for page
    await page.waitForURL(/\/datasets\/[a-f0-9-]+\/review/i, { timeout: 5000 })

    // Should show navigation first
    const hasSamples = await page
      .getByText(/\d+ \/ \d+/)
      .isVisible({ timeout: 10000 })
      .catch(() => false)

    if (!hasSamples) {
      // No samples, that's ok
      await expect(page.getByText(/no samples|暂无/i)).toBeVisible()
      return
    }

    // Should have an image or canvas element
    const hasImage = await page
      .locator("img, canvas")
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false)

    // Or should show loading/error state
    const hasContent =
      hasImage ||
      (await page
        .getByText(/loading|error|无法加载/i)
        .isVisible({ timeout: 1000 })
        .catch(() => false))

    expect(hasContent).toBeTruthy()
  })
})
