const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

interface TaskAssignedData {
  memberName: string;
  taskTitle: string;
  taskId: string;
  dueDate?: string | null;
  assignedByName: string;
  onBehalfOfName?: string | null; // the person who requested the task
}

/**
 * Clean HTML email template for task assignment notifications.
 */
export function taskAssignedTemplate(data: TaskAssignedData): string {
  const dueDateLine = data.dueDate
    ? `<p style="margin:8px 0;color:#64748b;font-size:14px;">
         <strong>Due:</strong> ${new Date(data.dueDate).toLocaleDateString('en-US', {
           weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
         })}
       </p>`
    : '';

  // When assigned on behalf of someone, show both names clearly
  const assignedByLine = data.onBehalfOfName
    ? `<strong style="color:#a5b4fc;">${data.onBehalfOfName}</strong> has assigned you a new task
       <span style="color:#64748b;font-size:13px;">(via <strong style="color:#94a3b8;">${data.assignedByName}</strong>)</span>:`
    : `<strong style="color:#a5b4fc;">${data.assignedByName}</strong> has assigned you a new task:`;

  const assignedByFooter = data.onBehalfOfName
    ? `Requested by <strong style="color:#94a3b8;">${data.onBehalfOfName}</strong>, assigned via <strong style="color:#94a3b8;">${data.assignedByName}</strong>`
    : `Assigned by <strong style="color:#94a3b8;">${data.assignedByName}</strong>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New Task Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0f172a;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;border-radius:12px 12px 0 0;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#c4b5fd;letter-spacing:2px;text-transform:uppercase;">Team Tracker</p>
              <h1 style="margin:0;font-size:28px;font-weight:700;color:#ffffff;">New Task Assigned</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background-color:#1e293b;padding:40px;border-radius:0 0 12px 12px;">
              <p style="margin:0 0 24px;font-size:16px;color:#cbd5e1;">
                Hi <strong style="color:#ffffff;">${data.memberName}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:15px;color:#94a3b8;line-height:1.6;">
                ${assignedByLine}
              </p>

              <!-- Task card -->
              <table width="100%" cellpadding="0" cellspacing="0"
                style="background-color:#0f172a;border:1px solid #334155;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 12px;font-size:18px;font-weight:600;color:#f1f5f9;">
                      ${data.taskTitle}
                    </p>
                    ${dueDateLine}
                    <p style="margin:8px 0 0;color:#64748b;font-size:13px;">
                      ${assignedByFooter}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
                <tr>
                  <td align="center">
                    <a href="${FRONTEND_URL}/tasks"
                      style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
                             color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">
                      View Task →
                    </a>
                  </td>
                </tr>
              </table>

              <hr style="border:none;border-top:1px solid #334155;margin:0 0 24px;" />

              <p style="margin:0;font-size:12px;color:#475569;text-align:center;line-height:1.6;">
                You're receiving this because you were assigned a task on Team Tracker.<br>
                Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
