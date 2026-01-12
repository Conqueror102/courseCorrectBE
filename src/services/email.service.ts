import { env } from '../config/env.js';

interface EmailOptions {
    to: string;
    subject: string;
    text: string;
    html: string;
}

/**
 * Send email using configured provider (SendGrid or Nodemailer SMTP)
 */
async function sendEmail(options: EmailOptions): Promise<boolean> {
    // Check which provider to use
    if (env.EMAIL_PROVIDER === 'sendgrid' && env.SENDGRID_API_KEY) {
        return sendWithSendGrid(options);
    } else if (env.EMAIL_PROVIDER === 'smtp' && env.SMTP_HOST) {
        return sendWithNodemailer(options);
    } else {
        // No email configured - log and return
        console.log(`[EMAIL SKIPPED] No email provider configured`);
        console.log(`[EMAIL] To: ${options.to} | Subject: ${options.subject}`);
        return true;
    }
}

/**
 * Send email via SendGrid
 */
async function sendWithSendGrid(options: EmailOptions): Promise<boolean> {
    try {
        // @ts-ignore
        const sgMail = await import('@sendgrid/mail').catch(() => null);
        
        if (!sgMail) {
            console.log('[EMAIL] SendGrid module not installed');
            return false;
        }
        
        sgMail.default.setApiKey(env.SENDGRID_API_KEY);
        
        await sgMail.default.send({
            to: options.to,
            from: env.EMAIL_FROM,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });
        return true;
    } catch (error: any) {
        console.error('[EMAIL ERROR - SendGrid]', error.response?.body || error.message);
        return false;
    }
}

/**
 * Send email via Nodemailer SMTP
 */
async function sendWithNodemailer(options: EmailOptions): Promise<boolean> {
    try {
        // @ts-ignore
        const nodemailer = await import('nodemailer').catch(() => null);
        
        if (!nodemailer) {
            console.log('[EMAIL] Nodemailer module not installed');
            return false;
        }

        const transporter = nodemailer.default.createTransport({
            host: env.SMTP_HOST,
            port: env.SMTP_PORT,
            secure: env.SMTP_SECURE,
            auth: {
                user: env.SMTP_USER,
                pass: env.SMTP_PASS,
            },
        });

        await transporter.sendMail({
            from: env.EMAIL_FROM,
            to: options.to,
            subject: options.subject,
            text: options.text,
            html: options.html,
        });
        return true;
    } catch (error: any) {
        console.error('[EMAIL ERROR - SMTP]', error.message);
        return false;
    }
}

/**
 * Send passkey to user after payment
 */
export async function sendPasskeyEmail(
    email: string, 
    name: string, 
    passkey: string
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: 'Your Platform Access Passkey',
        text: `Hello ${name},\n\nYour access passkey is: ${passkey}\n\nUse this passkey to activate your 30-day platform access.\n\nThank you!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hello ${name},</h2>
                <p>Your payment was successful! Here is your access passkey:</p>
                <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
                    <h1 style="color: #333; letter-spacing: 2px;">${passkey}</h1>
                </div>
                <p>Use this passkey to activate your 30-day platform access.</p>
                <p>Thank you for your purchase!</p>
            </div>
        `,
    });
}

/**
 * Send access expiry warning
 */
export async function sendExpiryWarning(
    email: string, 
    name: string,
    daysLeft: number
): Promise<boolean> {
    return sendEmail({
        to: email,
        subject: `Your Platform Access Expires in ${daysLeft} Days`,
        text: `Hello ${name},\n\nYour platform access expires in ${daysLeft} days. Please renew to continue accessing all courses.\n\nThank you!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>Hello ${name},</h2>
                <p>Your platform access expires in <strong>${daysLeft} days</strong>.</p>
                <p>Renew now to continue accessing all courses and content.</p>
                <p>Thank you!</p>
            </div>
        `,
    });
}
