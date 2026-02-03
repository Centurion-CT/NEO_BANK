import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { MailService } from './mail.service';

/**
 * Mail Module
 *
 * Handles:
 * - Email sending via SMTP
 * - Handlebars template rendering
 * - Common email operations (OTP, welcome, transactions)
 *
 * CONFIGURATION:
 * Set SMTP credentials in environment variables.
 * Templates are in src/modules/mail/templates/
 */
@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        transport: {
          host: configService.get<string>('mail.host'),
          port: configService.get<number>('mail.port'),
          secure: configService.get<boolean>('mail.secure'),
          auth: {
            user: configService.get<string>('mail.user'),
            pass: configService.get<string>('mail.password'),
          },
          ignoreTLS: configService.get<boolean>('mail.ignoreTLS'),
          requireTLS: configService.get<boolean>('mail.requireTLS'),
        },
        defaults: {
          from: `"${configService.get<string>('mail.fromName')}" <${configService.get<string>('mail.fromEmail')}>`,
        },
        template: {
          // Use src templates in development, dist templates in production
          dir: existsSync(join(process.cwd(), 'src', 'modules', 'mail', 'templates'))
            ? join(process.cwd(), 'src', 'modules', 'mail', 'templates')
            : join(__dirname, 'templates'),
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
