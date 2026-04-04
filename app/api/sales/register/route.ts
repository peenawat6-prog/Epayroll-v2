export async function POST(req: Request) {
  return Response.json(
    {
      error: "การลงทะเบียนเซลล์ทำได้โดยทีมซัพพอร์ตในหน้า DEV เท่านั้น",
    },
    {
      status: 403,
    },
  )
}
