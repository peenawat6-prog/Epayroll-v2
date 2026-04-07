import { spawn } from "node:child_process"
import net from "node:net"
import process from "node:process"

const REQUESTED_PORT = process.env.VERIFY_RUNTIME_PORT

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function waitForHealth(url, attempts = 30) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url)
      if (response.ok) {
        return
      }
    } catch {
      // Wait and retry while the server is still booting.
    }

    await delay(1000)
  }

  throw new Error(`health check did not pass within ${attempts} seconds`)
}

async function findAvailablePort() {
  if (REQUESTED_PORT) {
    return REQUESTED_PORT
  }

  return new Promise((resolve, reject) => {
    const server = net.createServer()

    server.listen(0, "127.0.0.1", () => {
      const address = server.address()

      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("could not resolve free port")))
        return
      }

      const { port } = address
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve(String(port))
      })
    })

    server.on("error", reject)
  })
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      ...options,
    })

    child.on("exit", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(" ")} failed with code ${code}`))
    })

    child.on("error", reject)
  })
}

async function main() {
  const PORT = await findAvailablePort()
  const BASE_URL = `http://127.0.0.1:${PORT}`

  console.log(`[verify-runtime] starting app on ${BASE_URL}`)

  const server =
    process.platform === "win32"
      ? spawn(
          "cmd.exe",
          ["/d", "/s", "/c", `npm run start -- --port ${PORT}`],
          {
            stdio: "inherit",
            shell: false,
            env: {
              ...process.env,
              PORT,
              NEXTAUTH_URL: BASE_URL,
            },
          },
        )
      : spawn(
          "npm",
          ["run", "start", "--", "--port", PORT],
          {
            stdio: "inherit",
            shell: false,
            env: {
              ...process.env,
              PORT,
              NEXTAUTH_URL: BASE_URL,
            },
          },
        )

  let serverStopped = false

  const stopServer = () => {
    if (serverStopped) {
      return
    }

    serverStopped = true
    server.kill("SIGTERM")
  }

  process.on("exit", stopServer)
  process.on("SIGINT", () => {
    stopServer()
    process.exit(130)
  })
  process.on("SIGTERM", () => {
    stopServer()
    process.exit(143)
  })

  try {
    await waitForHealth(`${BASE_URL}/api/health`)
    console.log("[verify-runtime] health check passed")

    await runCommand(
      process.execPath,
      ["scripts/smoke-test.mjs"],
      {
        env: {
          ...process.env,
          SMOKE_BASE_URL: BASE_URL,
        },
      },
    )

    console.log("[verify-runtime] smoke test passed")
  } finally {
    stopServer()
  }
}

main().catch((error) => {
  console.error(`[verify-runtime] failed: ${error.message}`)
  process.exit(1)
})
