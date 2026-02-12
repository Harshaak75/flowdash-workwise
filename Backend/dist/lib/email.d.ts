export declare const sendEmail: ({ to, subject, html, }: {
    to: string;
    subject: string;
    html: string;
}) => Promise<import("nodemailer/lib/smtp-transport").SentMessageInfo | undefined>;
export declare const sendWorkerErrorEmail: (workerName: string, error: any, jobData?: any) => Promise<void>;
//# sourceMappingURL=email.d.ts.map