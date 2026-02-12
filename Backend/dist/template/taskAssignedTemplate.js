"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskAssignedTemplate = void 0;
const taskAssignedTemplate = ({ title, priority, notes }) => {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>New Task Assigned</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f6f8; font-family: Arial, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr>
      <td align="center">

        <!-- Main Container -->
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden;">
          
          <!-- Header -->
          <tr>
            <td style="background:#2563eb; padding:20px; text-align:center;">
              <h2 style="color:#ffffff; margin:0;">New Task Assigned</h2>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:30px; color:#333333;">
              
              <p style="font-size:16px; margin-bottom:20px;">
                Hello,
              </p>

              <p style="font-size:15px; line-height:1.6;">
                A new task has been assigned to you. Please find the details below:
              </p>

              <!-- Task Details Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px; border:1px solid #e5e7eb; border-radius:6px;">
                <tr>
                  <td style="padding:12px 15px; background:#f9fafb; font-weight:bold; width:30%;">Title</td>
                  <td style="padding:12px 15px;">${title}</td>
                </tr>
                <tr>
                  <td style="padding:12px 15px; background:#f9fafb; font-weight:bold;">Priority</td>
                  <td style="padding:12px 15px;">${priority || "Not specified"}</td>
                </tr>
                <tr>
                  <td style="padding:12px 15px; background:#f9fafb; font-weight:bold;">Notes</td>
                  <td style="padding:12px 15px;">${notes || "No notes provided"}</td>
                </tr>
              </table>

              <!-- Button -->
              <div style="text-align:center; margin-top:30px;">
                <a href="https://flowbit.dotspeaks.com/login"
                   style="background:#2563eb; color:#ffffff; padding:12px 24px; text-decoration:none; border-radius:6px; font-size:15px; display:inline-block;">
                   Login to View Task
                </a>
              </div>

              <p style="margin-top:30px; font-size:14px; color:#6b7280;">
                If you have any questions, please contact your manager.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb; text-align:center; padding:15px; font-size:12px; color:#9ca3af;">
              © ${new Date().getFullYear()} FlowBit. All rights reserved.
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>
`;
};
exports.taskAssignedTemplate = taskAssignedTemplate;
//# sourceMappingURL=taskAssignedTemplate.js.map