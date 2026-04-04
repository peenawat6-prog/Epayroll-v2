'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="th">
      <body className="app-shell">
        <div className="page">
          <section className="panel">
            <div className="badge-row">
              <div className="badge">Application Error</div>
            </div>
            <h1 className="hero-title">เกิดข้อผิดพลาดที่ไม่คาดคิด</h1>
            <p className="hero-subtitle">
              ระบบยังทำงานได้บางส่วน แต่หน้านี้เกิดปัญหา กรุณาลองใหม่อีกครั้ง
            </p>
            <div className="message message-error" style={{ marginTop: 16 }}>
              {error.message || "Unknown error"}
            </div>
            <div className="action-row" style={{ marginTop: 16 }}>
              <button className="btn btn-primary" onClick={() => reset()}>
                ลองใหม่
              </button>
            </div>
          </section>
        </div>
      </body>
    </html>
  )
}
