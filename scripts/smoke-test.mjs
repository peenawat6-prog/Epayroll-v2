const BASE_URL = (process.env.SMOKE_BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const OWNER_EMAIL = process.env.SMOKE_OWNER_EMAIL || "owner@demo.local"
const OWNER_PASSWORD = process.env.SMOKE_OWNER_PASSWORD || "@Epayroll2026"
const EMPLOYEE_EMAIL = process.env.SMOKE_EMPLOYEE_EMAIL || "employee@demo.local"
const EMPLOYEE_PASSWORD = process.env.SMOKE_EMPLOYEE_PASSWORD || "@Epayroll2026"

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function logStep(message) {
  console.log(`[smoke] ${message}`)
}

function parseSetCookie(setCookieHeader) {
  if (!setCookieHeader) {
    return []
  }

  if (typeof setCookieHeader.getSetCookie === "function") {
    return setCookieHeader.getSetCookie()
  }

  const single = setCookieHeader.get("set-cookie")
  return single ? [single] : []
}

function mergeCookies(existingCookieHeader, response) {
  const cookieMap = new Map()

  if (existingCookieHeader) {
    for (const pair of existingCookieHeader.split(/;\s*/)) {
      const [name, ...rest] = pair.split("=")
      if (name && rest.length > 0) {
        cookieMap.set(name, rest.join("="))
      }
    }
  }

  for (const cookie of parseSetCookie(response.headers)) {
    const firstPart = cookie.split(";")[0]
    const [name, ...rest] = firstPart.split("=")
    if (name && rest.length > 0) {
      cookieMap.set(name, rest.join("="))
    }
  }

  return Array.from(cookieMap.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ")
}

async function getJson(url, init = {}) {
  const response = await fetch(url, {
    redirect: "manual",
    ...init,
  })

  const contentType = response.headers.get("content-type") || ""
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text()

  return {
    response,
    body,
  }
}

async function login(email, password, expectedUrl) {
  let cookieHeader = ""

  const csrfResult = await getJson(`${BASE_URL}/api/auth/csrf`)
  assert(
    csrfResult.response.ok && csrfResult.body?.csrfToken,
    `โหลด csrf token ไม่สำเร็จสำหรับ ${email}`,
  )
  cookieHeader = mergeCookies(cookieHeader, csrfResult.response)

  const formBody = new URLSearchParams({
    csrfToken: csrfResult.body.csrfToken,
    email,
    password,
    callbackUrl: `${BASE_URL}${expectedUrl}`,
    json: "true",
  })

  const loginResult = await getJson(
    `${BASE_URL}/api/auth/callback/credentials?json=true`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        cookie: cookieHeader,
      },
      body: formBody.toString(),
    },
  )

  cookieHeader = mergeCookies(cookieHeader, loginResult.response)
  assert(
    loginResult.response.ok && loginResult.body?.url === `${BASE_URL}${expectedUrl}`,
    `ล็อกอินไม่สำเร็จสำหรับ ${email}`,
  )

  return cookieHeader
}

async function run() {
  logStep(`base url: ${BASE_URL}`)

  const health = await getJson(`${BASE_URL}/api/health`)
  assert(health.response.ok, "health check ไม่ผ่าน")
  assert(health.body?.ok === true, "health check ไม่คืน ok=true")
  logStep("health check ผ่าน")

  const dashboardGuest = await fetch(`${BASE_URL}/dashboard`, {
    redirect: "manual",
  })
  assert(
    dashboardGuest.status === 307,
    `ก่อนล็อกอิน /dashboard ควร redirect แต่ได้ ${dashboardGuest.status}`,
  )
  logStep("protected route ก่อนล็อกอิน redirect ถูกต้อง")

  const ownerCookies = await login(OWNER_EMAIL, OWNER_PASSWORD, "/dashboard")
  const ownerMe = await getJson(`${BASE_URL}/api/me`, {
    headers: { cookie: ownerCookies },
  })
  assert(ownerMe.response.ok, "owner /api/me ไม่ผ่าน")
  assert(ownerMe.body?.role === "OWNER", "owner role ไม่ถูกต้อง")
  logStep("owner login ผ่าน")

  const ownerEndpoints = [
    "/api/dashboard-summary",
    "/api/employees",
    "/api/attendance",
    "/api/payroll/run",
    "/api/staff-requests",
    "/api/ops/summary",
  ]

  for (const path of ownerEndpoints) {
    const result = await fetch(`${BASE_URL}${path}`, {
      headers: { cookie: ownerCookies },
      redirect: "manual",
    })
    assert(result.ok, `owner เรียก ${path} ไม่ผ่าน (${result.status})`)
  }
  logStep("owner endpoints หลักผ่าน")

  const employeeCookies = await login(
    EMPLOYEE_EMAIL,
    EMPLOYEE_PASSWORD,
    "/employee",
  )
  const employeeMe = await getJson(`${BASE_URL}/api/employee/me`, {
    headers: { cookie: employeeCookies },
  })
  assert(employeeMe.response.ok, "employee /api/employee/me ไม่ผ่าน")
  assert(employeeMe.body?.user?.role === "EMPLOYEE", "employee role ไม่ถูกต้อง")
  logStep("employee login ผ่าน")

  const employeeAllowed = [
    "/api/me",
    "/api/employee/me",
    "/api/staff-requests",
  ]

  for (const path of employeeAllowed) {
    const result = await fetch(`${BASE_URL}${path}`, {
      headers: { cookie: employeeCookies },
      redirect: "manual",
    })
    assert(result.ok, `employee เรียก ${path} ไม่ผ่าน (${result.status})`)
  }

  const employeeRestricted = [
    "/api/payroll/run",
    "/api/ops/summary",
    "/api/audit",
  ]

  for (const path of employeeRestricted) {
    const result = await fetch(`${BASE_URL}${path}`, {
      headers: { cookie: employeeCookies },
      redirect: "manual",
    })
    assert(
      result.status === 403,
      `employee ควรถูกกัน ${path} แต่ได้ ${result.status}`,
    )
  }
  logStep("employee permissions ผ่าน")

  const publicBranches = await getJson(
    `${BASE_URL}/api/public/branches?registrationCode=DEMO-CAFE`,
  )
  assert(publicBranches.response.ok, "public branches lookup ไม่ผ่าน")
  assert(
    Array.isArray(publicBranches.body?.branches),
    "public branches response ไม่ถูกต้อง",
  )
  logStep("public branch lookup ผ่าน")

  logStep("smoke test ผ่านครบ")
}

run().catch((error) => {
  console.error(`[smoke] failed: ${error.message}`)
  process.exit(1)
})
