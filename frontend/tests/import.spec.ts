import { expect, test } from "@playwright/test"

// Note: Authentication is handled by auth.setup.ts via storageState

test.describe("Import Wizard", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/samples/import")
  })

  test("Import page is accessible from navigation", async ({ page }) => {
    // Navigate to samples page first
    await page.goto("/samples")

    // Click import button
    await page.getByRole("link", { name: /import/i }).click()

    // Should navigate to import page
    await page.waitForURL("/samples/import")
    await expect(page.getByRole("heading", { name: /import/i })).toBeVisible()
  })

  test("Import wizard shows step 1: Upload", async ({ page }) => {
    // Step indicator should show step 1 as active
    await expect(page.getByTestId("import-step-1")).toHaveAttribute(
      "data-active",
      "true",
    )

    // Should show file upload area
    await expect(page.getByTestId("file-upload-dropzone")).toBeVisible()
    await expect(
      page.getByText("Drag and drop your CSV file here"),
    ).toBeVisible()
  })

  test("Upload step accepts CSV file", async ({ page }) => {
    // Create a test CSV file
    const csvContent = `object_key,tags
images/2024/sample001.jpg,"cat/persian,trained"
images/2024/sample002.png,dog
labels/sample001.xml,`

    // Upload via file input
    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })

    // Should show file name
    await expect(page.getByText("test.csv")).toBeVisible()

    // Next button should be enabled
    await expect(page.getByRole("button", { name: /next/i })).toBeEnabled()
  })

  test("Upload step rejects non-CSV file", async ({ page }) => {
    // Upload a non-CSV file
    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not a csv"),
    })

    // Should show specific error message
    await expect(page.getByText("Please select a CSV file")).toBeVisible()

    // Next button should be disabled
    await expect(page.getByRole("button", { name: /next/i })).toBeDisabled()
  })

  test("Step 2 shows CSV preview data", async ({ page }) => {
    // Upload CSV
    const csvContent = `object_key,tags
images/sample001.jpg,"cat,dog"
images/sample002.png,bird
labels/sample001.xml,`

    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })

    // Click next to go to preview step
    await page.getByRole("button", { name: /next/i }).click()

    // Wait for step 2 to be active (may take time for API call)
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Should show preview statistics
    await expect(page.getByTestId("preview-total-rows")).toContainText("3")
    await expect(page.getByTestId("preview-image-count")).toContainText("2")
    await expect(page.getByTestId("preview-annotation-count")).toContainText(
      "1",
    )
    await expect(page.getByTestId("preview-has-tags")).toContainText(/yes/i)

    // Should show column badges
    await expect(
      page.locator('span:has-text("object_key")').first(),
    ).toBeVisible()
    await expect(page.locator('span:has-text("tags")').first()).toBeVisible()

    // Should show sample rows in table
    await expect(
      page.getByRole("cell", { name: "images/sample001.jpg" }),
    ).toBeVisible()
  })

  test("Step 3 shows configuration form", async ({ page }) => {
    // Upload CSV
    const csvContent = `object_key,tags
images/sample001.jpg,cat`

    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })

    // Go to step 2 (with longer timeout for API)
    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Go to step 3
    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-3")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Should show MinIO instance selector
    await expect(page.getByTestId("minio-instance-select")).toBeVisible()

    // Should show bucket input
    await expect(page.getByTestId("bucket-input")).toBeVisible()

    // Should show validate files checkbox
    await expect(page.getByTestId("validate-files-checkbox")).toBeVisible()

    // Start import button (disabled until config is filled)
    await expect(
      page.getByRole("button", { name: /start import/i }),
    ).toBeVisible()
  })

  test("Can navigate back between steps", async ({ page }) => {
    // Upload CSV
    const csvContent = `object_key,tags
images/sample001.jpg,cat`

    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })

    // Go to step 2
    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Go back to step 1
    await page.getByRole("button", { name: /back/i }).click()
    await expect(page.getByTestId("import-step-1")).toHaveAttribute(
      "data-active",
      "true",
    )

    // File should still be selected
    await expect(page.getByText("test.csv")).toBeVisible()
  })

  test("Step indicators show progress", async ({ page }) => {
    // Initial state: step 1 active, others inactive
    await expect(page.getByTestId("import-step-1")).toHaveAttribute(
      "data-active",
      "true",
    )
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "false",
    )
    await expect(page.getByTestId("import-step-3")).toHaveAttribute(
      "data-active",
      "false",
    )

    // Upload and go to step 2
    const csvContent = `object_key\nimages/sample001.jpg`
    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })
    await page.getByRole("button", { name: /next/i }).click()

    // Step 1 should be completed, step 2 active (with timeout for API)
    await expect(page.getByTestId("import-step-1")).toHaveAttribute(
      "data-completed",
      "true",
      { timeout: 10000 },
    )
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "true",
    )
  })
})

test.describe("Import Progress", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/samples/import")
  })

  test("Shows import progress during execution", async ({ page }) => {
    // Upload CSV with files that exist in test MinIO bucket
    const csvContent = `object_key,tags
images/sample001.jpg,cat
images/sample002.png,dog`

    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })

    // Go to step 2
    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Go to step 3
    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-3")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Check if MinIO instance exists
    await page.getByTestId("minio-instance-select").click()
    const hasMinioOptions = await page
      .getByRole("option")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (!hasMinioOptions) {
      test.skip(true, "No MinIO instances configured in the system")
      return
    }

    // Select first MinIO instance
    await page.getByRole("option").first().click()
    await page.getByTestId("bucket-input").fill("test-bucket")

    // Start import
    const startButton = page.getByRole("button", { name: /start import/i })
    await expect(startButton).toBeEnabled()
    await startButton.click()

    // Should show progress indicator or result
    // Either progress element or result (success/error) should appear
    await expect(
      page.getByTestId("import-progress").or(page.getByText(/成功|失败|completed|error/i))
    ).toBeVisible({ timeout: 15000 })
  })

  test("Shows import results when complete", async ({ page }) => {
    // Upload a simple CSV
    const csvContent = `object_key
images/sample001.jpg`

    const fileInput = page.getByTestId("file-input")
    await fileInput.setInputFiles({
      name: "test.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(csvContent),
    })

    // Navigate through steps
    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-2")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    await page.getByRole("button", { name: /next/i }).click()
    await expect(page.getByTestId("import-step-3")).toHaveAttribute(
      "data-active",
      "true",
      { timeout: 10000 },
    )

    // Check if MinIO instance exists
    await page.getByTestId("minio-instance-select").click()
    const hasMinioOptions = await page
      .getByRole("option")
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false)

    if (!hasMinioOptions) {
      test.skip(true, "No MinIO instances configured in the system")
      return
    }

    // Select MinIO and start import
    await page.getByRole("option").first().click()
    await page.getByTestId("bucket-input").fill("test-bucket")
    await page.getByRole("button", { name: /start import/i }).click()

    // Wait for import to complete - should show results
    // Results include counts for created/skipped/error
    await expect(
      page.getByText(/创建|created|成功|完成|completed/i)
    ).toBeVisible({ timeout: 30000 })
  })

  test("Can view import history", async ({ page }) => {
    // Should show import history section
    await expect(page.getByTestId("import-history")).toBeVisible()

    // When no tasks exist, shows "No import tasks yet" message
    await expect(page.getByText("No import tasks yet")).toBeVisible()
  })
})
