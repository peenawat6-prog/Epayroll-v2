import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "cloud.epayroll.app",
  appName: "Epayroll",
  webDir: "public",
  server: {
    url: "https://epayroll.cloud",
    cleartext: false,
    allowNavigation: ["epayroll.cloud"],
  },
}

export default config
