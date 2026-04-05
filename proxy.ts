import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = [
  "/login",
  "/employee/login",
  "/employee/register",
  "/management/register",
  "/shop/register",
  "/sales/register",
]
const PROTECTED_PATHS = [
  "/dev/dashboard",
  "/dashboard",
  "/employees",
  "/attendance",
  "/payroll",
  "/audit",
  "/ops",
  "/requests",
  "/employee",
]
const EMPLOYEE_ONLY_PATHS = ["/employee"]
const DEV_ONLY_PATHS = ["/dev/dashboard"]
const BACKOFFICE_PATHS = ["/dashboard", "/employees", "/attendance", "/payroll", "/audit", "/ops"]
const REGISTER_SUBDOMAIN_PREFIX = "register."
const MANAGEMENT_SUBDOMAIN_PREFIX = "manage."

function isProtectedPath(pathname: string) {
  return PROTECTED_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  )
}

function isRegisterSubdomain(hostname: string) {
  return hostname.toLowerCase().startsWith(REGISTER_SUBDOMAIN_PREFIX)
}

function isManagementSubdomain(hostname: string) {
  return hostname.toLowerCase().startsWith(MANAGEMENT_SUBDOMAIN_PREFIX)
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hostname = req.nextUrl.hostname
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (
    isRegisterSubdomain(hostname) &&
    !pathname.startsWith("/api") &&
    pathname !== "/shop/register"
  ) {
    return NextResponse.redirect(new URL("/shop/register", req.url))
  }

  if (
    isManagementSubdomain(hostname) &&
    !pathname.startsWith("/api") &&
    pathname !== "/management/register"
  ) {
    return NextResponse.redirect(new URL("/management/register", req.url))
  }

  if (!token && isProtectedPath(pathname) && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (token && isPublicPath(pathname)) {
    return NextResponse.redirect(
      new URL(
        token.role === "EMPLOYEE"
          ? "/employee"
          : token.role === "DEV"
            ? "/dev/dashboard"
            : "/dashboard",
        req.url,
      ),
    )
  }

  if (
    token?.role === "DEV" &&
    pathname.startsWith("/dashboard")
  ) {
    return NextResponse.redirect(new URL("/dev/dashboard", req.url))
  }

  if (
    token &&
    token.role !== "DEV" &&
    DEV_ONLY_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return NextResponse.redirect(
      new URL(token.role === "EMPLOYEE" ? "/employee" : "/dashboard", req.url),
    )
  }

  if (
    token?.role === "EMPLOYEE" &&
    BACKOFFICE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return NextResponse.redirect(new URL("/employee", req.url))
  }

  if (
    token &&
    token.role !== "EMPLOYEE" &&
    EMPLOYEE_ONLY_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  ) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/employee/login",
    "/management/register",
    "/shop/register",
    "/sales/register",
    "/dev/dashboard/:path*",
    "/dashboard/:path*",
    "/employees/:path*",
    "/attendance/:path*",
    "/payroll/:path*",
    "/audit/:path*",
    "/ops/:path*",
    "/requests/:path*",
    "/employee/:path*",
  ],
}
