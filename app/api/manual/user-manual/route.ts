import path from "node:path"
import { readFile } from "node:fs/promises"
import { AppError } from "@/lib/http"
import { withAuthorizedRoute } from "@/lib/route-guard"

export const GET = withAuthorizedRoute({}, async () => {
  const pdfPath = path.join(process.cwd(), "docs", "USER_MANUAL.pdf")

  try {
    const pdfFile = await readFile(pdfPath)

    return new Response(pdfFile, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Epayroll-User-Manual.pdf"',
        "Cache-Control": "no-store",
      },
    })
  } catch {
    throw new AppError("User manual PDF not found", 404, "NOT_FOUND")
  }
})
