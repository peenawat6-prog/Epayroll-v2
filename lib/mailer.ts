import nodemailer from "nodemailer"

function getMailerConfig() {
  return {
    host: process.env.SMTP_HOST?.trim() || "",
    port: Number(process.env.SMTP_PORT?.trim() || "587"),
    secure: process.env.SMTP_SECURE?.trim() === "true",
    user: process.env.SMTP_USER?.trim() || "",
    pass: process.env.SMTP_PASS?.trim() || "",
    from: process.env.SMTP_FROM?.trim() || "",
  }
}

export function isMailerConfigured() {
  const config = getMailerConfig()

  return Boolean(
    config.host &&
      Number.isFinite(config.port) &&
      config.user &&
      config.pass &&
      config.from,
  )
}

export async function sendMail(input: {
  to: string
  subject: string
  text: string
  html: string
}) {
  const config = getMailerConfig()

  if (!isMailerConfigured()) {
    throw new Error("Mailer is not configured")
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  await transporter.sendMail({
    from: config.from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  })
}
