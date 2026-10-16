/**
 * CreditWise AI — Email Delivery Service
 * Sends transactional emails including OTP password reset verification codes.
 * Supports SMTP (via Nodemailer), Resend API, and safe console fallback in dev.
 */

import nodemailer from "nodemailer";

interface SendPasswordResetEmailParams {
  toEmail: string;
  code: string;
  recipientName?: string;
}

export async function sendPasswordResetEmail({
  toEmail,
  code,
  recipientName,
}: SendPasswordResetEmailParams): Promise<{ success: boolean; error?: string; devCode?: string }> {
  const recipient = recipientName || "CreditWise User";
  const normalizedEmail = toEmail.trim().toLowerCase();

  // 1. Resend API Integration (if RESEND_API_KEY is provided)
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const fromEmail = process.env.RESEND_FROM || "CreditWise AI <noreply@creditwise.ai>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: normalizedEmail,
          subject: `${code} is your CreditWise AI password reset code`,
          html: generateResetEmailHtml(code, recipient),
        }),
      });

      if (res.ok) {
        console.log(`[EMAIL] Reset code sent via Resend to ${normalizedEmail}`);
        return { success: true };
      } else {
        const data = await res.json().catch(() => ({}));
        console.warn("[EMAIL] Resend API error:", data);
      }
    } catch (err: any) {
      console.error("[EMAIL] Resend delivery failed:", err.message);
    }
  }

  // 2. SMTP Integration (if SMTP_HOST or EMAIL_SERVER_HOST is configured)
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || "587", 10);
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD;
  const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || "CreditWise AI <noreply@creditwise.ai>";

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpFrom,
        to: normalizedEmail,
        subject: `${code} is your CreditWise AI password reset code`,
        text: `Your CreditWise AI password reset code is: ${code}. This code expires in 15 minutes. If you did not request this, please ignore this email.`,
        html: generateResetEmailHtml(code, recipient),
      });

      console.log(`[EMAIL] Reset code sent via SMTP to ${normalizedEmail}`);
      return { success: true };
    } catch (err: any) {
      console.error("[EMAIL] SMTP delivery failed:", err.message);
    }
  }

  // 3. Fallback for Development & Local Environments without SMTP
  console.log("==========================================================");
  console.log(`🔑 [CREDITWISE AUTH] PASSWORD RESET VERIFICATION CODE`);
  console.log(`📧 Target Email:   ${normalizedEmail}`);
  console.log(`🔢 6-Digit Code:   ${code}`);
  console.log(`⏳ Expiration:     15 Minutes`);
  console.log("==========================================================");

  return {
    success: true,
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

function generateResetEmailHtml(code: string, recipientName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password — CreditWise AI</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 0;
      color: #1e293b;
    }
    .wrapper {
      width: 100%;
      max-width: 560px;
      margin: 40px auto;
      background-color: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px 36px;
      text-align: center;
      border-bottom: 2px solid #2563eb;
    }
    .brand {
      font-size: 24px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.5px;
      margin: 0;
    }
    .brand span {
      color: #38bdf8;
    }
    .content {
      padding: 36px;
    }
    h2 {
      font-size: 20px;
      font-weight: 700;
      color: #0f172a;
      margin: 0 0 12px;
    }
    p {
      font-size: 15px;
      line-height: 1.6;
      color: #475569;
      margin: 0 0 20px;
    }
    .code-box {
      background: #f1f5f9;
      border: 2px dashed #93c5fd;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      margin: 28px 0;
    }
    .code-label {
      font-size: 11px;
      font-weight: 700;
      color: #2563eb;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 6px;
    }
    .code {
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
      font-size: 36px;
      font-weight: 800;
      color: #1e3a8a;
      letter-spacing: 8px;
    }
    .footer {
      background-color: #f8fafc;
      padding: 24px 36px;
      border-top: 1px solid #e2e8f0;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
      line-height: 1.5;
    }
    .warning {
      background-color: #fffbeb;
      border: 1px solid #fef3c7;
      border-radius: 8px;
      padding: 12px 16px;
      font-size: 13px;
      color: #92400e;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="brand">CreditWise<span>AI</span></div>
    </div>
    <div class="content">
      <h2>Password Reset Request</h2>
      <p>Hello ${recipientName},</p>
      <p>We received a request to reset your password for your CreditWise AI account. Enter the 6-digit verification code below on the password reset screen:</p>
      
      <div class="code-box">
        <div class="code-label">Verification Code</div>
        <div class="code">${code}</div>
      </div>

      <div class="warning">
        ⏳ <strong>Note:</strong> This verification code is valid for <strong>15 minutes</strong>. It can only be used once.
      </div>

      <p style="margin-top: 24px; font-size: 13px; color: #64748b;">
        If you did not request a password reset, no changes have been made to your account. You can safely disregard this email or contact support if you suspect unauthorized activity.
      </p>
    </div>
    <div class="footer">
      &copy; ${new Date().getFullYear()} CreditWise AI Financial Technologies. All rights reserved.<br>
      This is an automated security transmission. Please do not reply directly to this email.
    </div>
  </div>
</body>
</html>
  `;
}
