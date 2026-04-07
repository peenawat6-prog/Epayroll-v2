import type { UserRole } from "@prisma/client"

declare module "next-auth" {
  interface Session {
    user?: {
      id?: string
      email?: string | null
      role?: UserRole
      tenantId?: string
      employeeId?: string | null
    }
  }

  interface User {
    id: string
    email: string
    role: UserRole
    tenantId: string
    employeeId: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string
    role?: UserRole
    tenantId?: string
    employeeId?: string | null
  }
}
