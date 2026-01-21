import fs from "node:fs"
import path from "node:path"
import { test as base, expect } from "@playwright/test"

const coverageDir = path.join(process.cwd(), ".nyc_output")
const collectCoverage = process.env.VITE_COVERAGE === "true"

// Ensure coverage directory exists
if (collectCoverage && !fs.existsSync(coverageDir)) {
  fs.mkdirSync(coverageDir, { recursive: true })
}

// Counter for unique coverage filenames
let coverageCounter = 0

// Extended test that automatically collects coverage after each test
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    // Use the page normally
    await use(page)

    // After test completes, collect coverage if available
    if (collectCoverage) {
      try {
        const coverage = await page.evaluate(() => {
          // window.__coverage__ is injected by istanbul
          return (window as unknown as { __coverage__?: Record<string, unknown> }).__coverage__
        })

        if (coverage) {
          coverageCounter++
          const sanitizedTitle = testInfo.title.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 50)
          const fileName = `coverage-${coverageCounter}-${sanitizedTitle}.json`
          const filePath = path.join(coverageDir, fileName)
          fs.writeFileSync(filePath, JSON.stringify(coverage))
        }
      } catch {
        // Coverage not available, skip silently
      }
    }
  },
})

export { expect }
