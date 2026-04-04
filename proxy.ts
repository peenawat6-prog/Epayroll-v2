import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

const PUBLIC_PATHS = ["/login", "/employee/login", "/employee/register"]
const PROTECTED_PATHS = [
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
const BACKOFFICE_PATHS = ["/dashboard", "/employees", "/attendance", "/payroll", "/audit", "/ops"]

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

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  })

  if (!token && isProtectedPath(pathname) && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL("/login", req.url))
  }

  if (token && isPublicPath(pathname)) {
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
    "/login",
    "/employee/login",
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
