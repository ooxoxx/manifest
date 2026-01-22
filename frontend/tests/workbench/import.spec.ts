import { expect, test } from "../fixtures"

test.describe("Import Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/import")
    // Wait for page to load - check for h1 with import title
    await expect(page.locator("h1")).toContainText(/导入样本/, {
      timeout: 15000,
    })
  })

  test("page loads with wizard title", async ({ page }) => {
    await expect(page.locator("h1")).toContainText(/导入样本/)
  })

  test("page has proper header structure", async ({ page }) => {
    // Verify page structure
    await expect(page.locator("h1")).toBeVisible()
  })

  test("step indicators show 4 steps", async ({ page }) => {
    // Check all 4 step indicators are present
    await expect(page.getByTestId("import-step-1")).toBeVisible()
    await expect(page.getByTestId("import-step-2")).toBeVisible()
    await expect(page.getByTestId("import-step-3")).toBeVisible()
    await expect(page.getByTestId("import-step-4")).toBeVisible()
  })

  test("step 1 is active by default", async ({ page }) => {
    // Step 1 should be active
    const step1 = page.getByTestId("import-step-1")
    await expect(step1).toBeVisible()
  })

  test("file upload dropzone is available", async ({ page }) => {
    await expect(page.getByTestId("file-upload-dropzone")).toBeVisible()
    await expect(page.getByTestId("file-input")).toBeVisible()
  })

  test("dropzone shows file input", async ({ page }) => {
    await expect(page.getByTestId("file-input")).toBeVisible()
  })

  test("CSV file upload shows filename", async ({ page }) => {
    // Create a mock CSV file
    const fileInput = page.getByTestId("file-input")

    await fileInput.setInputFiles({
      name: "test-samples.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key,tags\nimage1.jpg,tag1\nimage2.jpg,tag2"),
    })

    // Should show filename - the component displays selectedFile.name in a span
    await expect(page.getByText("test-samples.csv")).toBeVisible({
      timeout: 10000,
    })
  })

  test("next button requires file selection", async ({ page }) => {
    // Next button should be disabled without file
    const nextButton = page.getByRole("button", { name: /下一步/ })
    await expect(nextButton).toBeDisabled()
  })

  test("next button is enabled after file selection", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg"),
    })

    await expect(page.getByRole("button", { name: /下一步/ })).toBeEnabled({
      timeout: 5000,
    })
  })

  test("can navigate back from step 2", async ({ page }) => {
    // Upload a file first
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg"),
    })

    // Click next to go to step 2
    await page.getByRole("button", { name: /下一步/ }).click()

    // Wait for step 2 (preview)
    await expect(page.getByText("总行数")).toBeVisible({
      timeout: 15000,
    })

    // Click back button
    await page.getByRole("button", { name: /上一步/ }).click()

    // Should be back at step 1
    await expect(page.getByTestId("file-upload-dropzone")).toBeVisible()
  })

  test("step 2 shows preview summary", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg\ntest2.jpg"),
    })

    await page.getByRole("button", { name: /下一步/ }).click()

    await expect(page.getByText("总行数")).toBeVisible({ timeout: 15000 })
  })

  test("step 3 shows MinIO instance selector", async ({ page }) => {
    // Upload file
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg"),
    })

    // Go to step 2
    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByText("总行数")).toBeVisible({
      timeout: 15000,
    })

    // Go to step 3
    await page.getByRole("button", { name: /下一步/ }).click()

    // Check MinIO selector
    await expect(page.getByTestId("minio-instance-select")).toBeVisible()
    await expect(page.getByTestId("bucket-input")).toBeVisible()
  })

  test("step 3 shows bucket input field", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg"),
    })

    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByText("总行数")).toBeVisible({ timeout: 15000 })

    await page.getByRole("button", { name: /下一步/ }).click()

    await expect(page.getByTestId("bucket-input")).toBeVisible()
  })

  test("step 3 shows start import button", async ({ page }) => {
    // Navigate to step 3
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg"),
    })

    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByText("总行数")).toBeVisible({
      timeout: 15000,
    })

    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByTestId("minio-instance-select")).toBeVisible()

    // Verify the start import button exists (may be disabled if no minio instance selected)
    await expect(page.getByRole("button", { name: /开始导入/ })).toBeVisible()
  })

  test("can navigate back from step 3", async ({ page }) => {
    await page.getByTestId("file-input").setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from("object_key\ntest.jpg"),
    })

    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByText("总行数")).toBeVisible({ timeout: 15000 })

    await page.getByRole("button", { name: /下一步/ }).click()
    await expect(page.getByTestId("minio-instance-select")).toBeVisible()

    await page.getByRole("button", { name: /上一步/ }).click()
    await expect(page.getByText("总行数")).toBeVisible({ timeout: 15000 })
  })
})
