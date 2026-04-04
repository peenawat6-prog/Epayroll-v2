import type { UserRole } from "@prisma/client"
import type { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from "bcrypt"
import { validateServerEnv } from "@/lib/env"
import { prisma } from "@/lib/prisma"

export type SessionUser = {
  id: string
  email: string
  role: UserRole
  tenantId: string
  employeeId: string | null
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email.trim().toLowerCase(),
          },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
            tenantId: true,
            employee: {
              select: {
                id: true,
              },
            },
          },
        })

        if (!user?.passwordHash) {
          return null
        }

        const isValidPassword = await bcrypt.compare(
          credentials.password,
          user.passwordHash,
        )

        if (!isValidPassword) {
          return null
        }

        if (user.role === "EMPLOYEE" && !user.employee?.id) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          employeeId: user.employee?.id ?? null,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as SessionUser).role
        token.tenantId = (user as SessionUser).tenantId
        token.employeeId = (user as SessionUser).employeeId
      }

      return token
    },
    async session({ session, token }) {
      if (session.user && token.id && token.role && token.tenantId && token.email) {
        session.user.id = token.id
        session.user.email = token.email
        session.user.role = token.role as UserRole
        session.user.tenantId = token.tenantId
        session.user.employeeId =
          typeof token.employeeId === "string" ? token.employeeId : null
      }

      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

export async function getSessionUser(): Promise<SessionUser | null> {
  validateServerEnv()
  const session = await getServerSession(authOptions)

  if (
    !session?.user?.id ||
    !session.user.email ||
    !session.user.role ||
    !session.user.tenantId
  ) {
    return null
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    select: {
      id: true,
      email: true,
      role: true,
      tenantId: true,
      employee: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!user) {
    return null
  }

  if (user.role === "EMPLOYEE" && !user.employee?.id) {
    return null
  }

  return user
    ? {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        employeeId: user.employee?.id ?? null,
      }
    : null
}
