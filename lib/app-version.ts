import fs from "node:fs"
import path from "node:path"

let cachedVersion: string | null = null

export function getAppVersion() {
  if (process.env.npm_package_version) {
    return process.env.npm_package_version
  }

  if (cachedVersion) {
    return cachedVersion
  }

  try {
    const packageJsonPath = path.join(process.cwd(), "package.json")
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as {
      version?: string
    }

    cachedVersion = packageJson.version ?? "0.0.0"
    return cachedVersion
  } catch {
    return "0.0.0"
  }
}
