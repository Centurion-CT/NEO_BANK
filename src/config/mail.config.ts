import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  // SMTP Configuration
  host: process.env.MAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.MAIL_PORT || '587', 10),
  secure: process.env.MAIL_SECURE === 'true', // true for 465, false for other ports

  // Authentication
  user: process.env.MAIL_USER,
  password: process.env.MAIL_PASSWORD,

  // Sender Info
  fromName: process.env.MAIL_FROM_NAME || 'BankApp',
  fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@bankapp.com',

  // Options
  ignoreTLS: process.env.MAIL_IGNORE_TLS === 'true',
  requireTLS: process.env.MAIL_REQUIRE_TLS === 'true',

  // Rate limiting (emails per minute)
  rateLimit: parseInt(process.env.MAIL_RATE_LIMIT || '30', 10),
}));
