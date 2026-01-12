import dotenv from "dotenv"
dotenv.config()

// Decode base64 private key
const decodeMuxPrivateKey = () => {
    const base64Key = process.env.MUX_PRIVATE_KEY || "";
    if (!base64Key) return "";
    return Buffer.from(base64Key, "base64").toString("utf-8");
};

export const env = {
    PORT: Number(process.env.PORT) || 5000,
    DATABASE_URL: process.env.DATABASE_URL || "",
    JWT_SECRET: process.env.JWT_SECRET || "secret",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "refresh-secret",
    // Payment
    PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY || "",
    // Email - Provider selection
    EMAIL_PROVIDER: process.env.EMAIL_PROVIDER || "", // 'sendgrid' or 'smtp'
    EMAIL_FROM: process.env.EMAIL_FROM || "noreply@example.com",
    // SendGrid
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY || "",
    // SMTP (Nodemailer)
    SMTP_HOST: process.env.SMTP_HOST || "",
    SMTP_PORT: Number(process.env.SMTP_PORT) || 587,
    SMTP_SECURE: process.env.SMTP_SECURE === "true",
    SMTP_USER: process.env.SMTP_USER || "",
    SMTP_PASS: process.env.SMTP_PASS || "",
    // Media
    MUX_TOKEN_ID: process.env.MUX_TOKEN_ID || "",
    MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET || "",
    MUX_SIGNING_KEY: process.env.MUX_SIGNING_KEY || "",
    MUX_PRIVATE_KEY: decodeMuxPrivateKey(),
    MUX_WEBHOOK_SECRET: process.env.MUX_WEBHOOK_SECRET || "",
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || ""
}

