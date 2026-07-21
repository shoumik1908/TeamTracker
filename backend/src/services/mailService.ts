import nodemailer from 'nodemailer';

// Validate SMTP config on module load
const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;

if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  console.warn(
    '[MailService] ⚠️  SMTP env vars missing (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS). ' +
    'Email notifications are DISABLED until these are set.'
  );
}

const port = parseInt(SMTP_PORT || '587', 10);

const transporter = nodemailer.createTransport({
  host: SMTP_HOST || '',
  port,
  // port 465 requires SSL; all other ports use STARTTLS
  secure: port === 465,
  auth: { user: SMTP_USER || '', pass: SMTP_PASS || '' },
});

// Verify SMTP connection on startup (non-blocking)
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter.verify().then(() => {
    console.log('[MailService] ✅  SMTP connection verified — email notifications active');
  }).catch((err: Error) => {
    console.error('[MailService] ❌  SMTP connection FAILED:', err.message);
  });
}

interface MailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email via SMTP.
 * Failures are caught and logged — they will NEVER throw or block the caller.
 */
export async function sendMail(options: MailOptions & { taskId?: string }): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    // silently skip — warning already shown at startup
    return;
  }

  // ponytail: fire-and-forget, no queue. Upgrade path: swap this for a BullMQ job.
  // TODO: Add BullMQ queue here for retry support and observability.
  try {
    const info = await transporter.sendMail({
      from: `"Team Tracker" <${SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    console.log(
      `[MailService] ✅  Email sent to ${options.to}` +
      (options.taskId ? ` [taskId=${options.taskId}]` : '') +
      ` (messageId=${info.messageId})`
    );
  } catch (err: any) {
    console.error(
      `[MailService] ❌  Failed to send email to ${options.to}` +
      (options.taskId ? ` [taskId=${options.taskId}]` : '') +
      `: ${err.message}`
    );
  }
}
