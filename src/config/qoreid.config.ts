import { registerAs } from '@nestjs/config';

export default registerAs('qoreid', () => ({
  // API Configuration
  baseUrl: process.env.QOREID_BASE_URL || 'https://api.qoreid.com',

  // Credentials
  clientId: process.env.QOREID_CLIENT_ID,
  clientSecret: process.env.QOREID_CLIENT_SECRET,

  // Token settings
  tokenExpiryBuffer: 300, // Refresh token 5 minutes before expiry

  // Sandbox mode
  sandbox: process.env.QOREID_SANDBOX === 'true',
}));
