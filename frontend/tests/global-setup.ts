import fs from "node:fs"
import path from "node:path"

const coverageDir = path.join(process.cwd(), ".nyc_output")

export default async function globalSetup() {
  // Clean up previous coverage data
  if (fs.existsSync(coverageDir)) {
    const files = fs.readdirSync(coverageDir)
    for (const file of files) {
      if (file.endsWith(".json")) {
        fs.unlinkSync(path.join(coverageDir, file))
      }
    }
  } else {
    fs.mkdirSync(coverageDir, { recursive: true })
  }

  console.log("E2E Coverage: Collecting coverage data to .nyc_output/")
}
