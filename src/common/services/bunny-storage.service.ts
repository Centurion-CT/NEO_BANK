import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class BunnyStorageService {
  private readonly logger = new Logger(BunnyStorageService.name);
  private readonly storageApiKey: string;
  private readonly storageZone: string;
  private readonly storageHostname: string;
  private readonly cdnHostname: string;

  constructor(private readonly configService: ConfigService) {
    this.storageApiKey = this.configService.get<string>('bunny.storageApiKey', '');
    this.storageZone = this.configService.get<string>('bunny.storageZone', '');
    this.storageHostname = this.configService.get<string>('bunny.storageHostname', 'storage.bunnycdn.com');
    this.cdnHostname = this.configService.get<string>('bunny.cdnHostname', '');
  }

  /**
   * Upload a file to Bunny Storage and return the CDN URL.
   */
  async uploadFile(buffer: Buffer, path: string, contentType: string): Promise<string> {
    const url = `https://${this.storageHostname}/${this.storageZone}/${path}`;

    await axios.put(url, buffer, {
      headers: {
        AccessKey: this.storageApiKey,
        'Content-Type': contentType,
      },
    });

    this.logger.log(`Uploaded file to ${path}`);
    return `https://${this.cdnHostname}/${path}`;
  }

  /**
   * Delete a file from Bunny Storage.
   */
  async deleteFile(path: string): Promise<void> {
    const url = `https://${this.storageHostname}/${this.storageZone}/${path}`;

    try {
      await axios.delete(url, {
        headers: {
          AccessKey: this.storageApiKey,
        },
      });
      this.logger.log(`Deleted file at ${path}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file at ${path}: ${error.message}`);
    }
  }
}
