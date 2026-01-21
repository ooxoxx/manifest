import { execSync } from "node:child_process"
import fs from "node:fs"
import path from "node:path"

const coverageDir = path.join(process.cwd(), ".nyc_output")

export default async function globalTeardown() {
  // Check if there are coverage files
  if (!fs.existsSync(coverageDir)) {
    console.log("E2E Coverage: No coverage data directory found")
    return
  }

  const files = fs.readdirSync(coverageDir).filter((f) => f.endsWith(".json"))
  if (files.length === 0) {
    console.log("E2E Coverage: No coverage files found")
    return
  }

  console.log(`E2E Coverage: Found ${files.length} coverage file(s). Generating report...`)

  try {
    // Generate coverage report using nyc
    execSync(
      "npx nyc report --reporter=text --reporter=html --reporter=text-summary --report-dir=coverage",
      {
        cwd: process.cwd(),
        stdio: "inherit",
      },
    )
    console.log("E2E Coverage: Report generated in coverage/ directory")
  } catch (error) {
    console.error("E2E Coverage: Failed to generate report:", error)
  }
}
