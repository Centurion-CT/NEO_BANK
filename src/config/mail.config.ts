import { registerAs } from '@nestjs/config';

export default registerAs('mail', () => ({
  // SendPipe Configuration
  sendpipeApiKey: process.env.SENDPIPE_API_KEY,
  sendpipeBaseUrl: process.env.SENDPIPE_BASE_URL || 'https://sendpipe.fregatelab.com/v1',

  // Sender Info
  fromName: process.env.MAIL_FROM_NAME || 'BankApp',
  fromEmail: process.env.MAIL_FROM_EMAIL || 'noreply@bankapp.com',
}));
