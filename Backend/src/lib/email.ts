import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const sendEmail = async ({
    to,
    subject,
    html,
}: {
    to: string;
    subject: string;
    html: string;
}) => {
    try {
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html,
        });
        console.log("Email sent: %s", info.messageId);
        return info;
    } catch (error) {
        console.error("Error sending email:", error);
        // Don't throw, just log. Or throw if critical.
    }
};

export const sendWorkerErrorEmail = async (workerName: string, error: any, jobData?: any) => {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;

    if (!adminEmail) {
        console.warn("No ADMIN_EMAIL or SMTP_USER defined. Cannot send worker error notification.");
        return;
    }

    console.log(`Sending worker error alert to: ${adminEmail}`);

    const subject = `🚨 CRITICAL: Worker [${workerName}] Failed/Error`;

    const html = `
    <div style="font-family: Arial, sans-serif; color: #333;">
      <h2 style="color: #D32F2F;">Worker Failure Alert</h2>
      <p>The worker <strong>${workerName}</strong> has encountered a critical error.</p>
      
      <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; padding: 15px; border-radius: 5px; color: #721c24;">
        <strong>Error Message:</strong>
        <pre>${error?.message || error}</pre>
      </div>

      ${error?.stack ? `
      <div style="margin-top: 15px;">
        <strong>Stack Trace:</strong>
        <pre style="background: #f4f4f4; padding: 10px; font-size: 12px; overflow-x: auto;">${error.stack}</pre>
      </div>` : ''}

      ${jobData ? `
      <div style="margin-top: 15px;">
        <strong>Job Data Context:</strong>
        <pre style="background: #e2e3e5; padding: 10px; font-size: 12px; overflow-x: auto;">${JSON.stringify(jobData, null, 2)}</pre>
      </div>` : ''}

      <p style="margin-top: 20px;">Please check the server logs and restart the worker if necessary.</p>
      <p style="font-size: 0.8em; color: #777;">Sent automatically by FlowDash WorkWise Backend.</p>
    </div>
  `;

    await sendEmail({ to: adminEmail, subject, html });
};
