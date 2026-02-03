import { registerAs } from '@nestjs/config';

export default registerAs('bunny', () => ({
  storageApiKey: process.env.BUNNY_STORAGE_API_KEY || '',
  storageZone: process.env.BUNNY_STORAGE_ZONE || '',
  storageHostname: process.env.BUNNY_STORAGE_HOSTNAME || 'storage.bunnycdn.com',
  cdnHostname: process.env.BUNNY_CDN_HOSTNAME || '',
}));
