import { sendEmail } from "./email";

export const sendReportCompletionEmail = async ({
    to,
    reportTitle,
    reportType,
    fromDate,
    toDate,
    downloadUrl,
    generatorName,
}: {
    to: string;
    reportTitle: string;
    reportType: string;
    fromDate: Date;
    toDate: Date;
    downloadUrl: string;
    generatorName: string;
}) => {
    const subject = `✅ Report Ready: ${reportTitle}`;

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #0000cc 0%, #0000ff 100%); padding: 40px 30px; text-align: center;">
                                <div style="background-color: rgba(255,255,255,0.15); width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center;">
                                    <span style="font-size: 40px;">📊</span>
                                </div>
                                <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">Report Generated Successfully!</h1>
                                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Your report is ready to download</p>
                            </td>
                        </tr>

                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="color: #333; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
                                    Hello <strong>${generatorName}</strong>,
                                </p>
                                <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 30px 0;">
                                    The report you requested has been successfully generated and is now ready for download.
                                </p>

                                <!-- Report Details Box -->
                                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                                    <tr>
                                        <td>
                                            <h3 style="color: #0000cc; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">📋 Report Details</h3>
                                            <table width="100%" cellpadding="8" cellspacing="0">
                                                <tr>
                                                    <td style="color: #666; font-size: 14px; width: 140px;"><strong>Report Title:</strong></td>
                                                    <td style="color: #333; font-size: 14px;">${reportTitle}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #666; font-size: 14px;"><strong>Report Type:</strong></td>
                                                    <td style="color: #333; font-size: 14px;">${reportType}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #666; font-size: 14px;"><strong>Period:</strong></td>
                                                    <td style="color: #333; font-size: 14px;">${fromDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${toDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                                                </tr>
                                                <tr>
                                                    <td style="color: #666; font-size: 14px;"><strong>Generated:</strong></td>
                                                    <td style="color: #333; font-size: 14px;">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                                                </tr>
                                            </table>
                                        </td>
                                    </tr>
                                </table>

                                <!-- Download Button -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding: 20px 0;">
                                            <a href="${downloadUrl}" style="display: inline-block; background: linear-gradient(135deg, #0000cc 0%, #0000ff 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,0,204,0.3); transition: all 0.3s;">
                                                📥 Download Report
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <p style="color: #777; font-size: 13px; line-height: 1.6; margin: 30px 0 0 0; text-align: center;">
                                    If the button doesn't work, copy and paste this link into your browser:<br>
                                    <a href="${downloadUrl}" style="color: #0000cc; word-break: break-all;">${downloadUrl}</a>
                                </p>
                            </td>
                        </tr>

                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                                <p style="color: #999; font-size: 13px; margin: 0 0 10px 0;">
                                    This is an automated notification from <strong style="color: #0000cc;">FlowDash WorkWise</strong>
                                </p>
                                <p style="color: #bbb; font-size: 12px; margin: 0;">
                                    © ${new Date().getFullYear()} DotSpeaks NGO. All rights reserved.
                                </p>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    try {
        await sendEmail({ to, subject, html });
        console.log(`✅ Report completion email sent to: ${to}`);
    } catch (error) {
        console.error(`❌ Failed to send report completion email to ${to}:`, error);
    }
};
