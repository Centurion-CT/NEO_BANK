import { Module, Global } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { MailService } from './mail.service';

function resolveTemplateDir(): string {
  // Candidate paths in priority order
  const candidates = [
    // Development: src templates
    join(process.cwd(), 'src', 'modules', 'mail', 'templates'),
    // Production: templates relative to compiled module
    join(__dirname, 'templates'),
    // Production fallback: dist/modules/mail/templates (when rootDir mismatch)
    join(process.cwd(), 'dist', 'modules', 'mail', 'templates'),
  ];

  for (const dir of candidates) {
    if (existsSync(dir)) {
      try {
        const files = readdirSync(dir);
        if (files.some((f) => f.endsWith('.hbs'))) {
          return dir;
        }
      } catch {
        // Skip inaccessible directories
      }
    }
  }

  // Final fallback to __dirname/templates
  return join(__dirname, 'templates');
}

@Global()
@Module({
  imports: [
    MailerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const host = configService.get<string>('mail.host');
        const port = configService.get<number>('mail.port');
        const secure = configService.get<boolean>('mail.secure');
        const user = configService.get<string>('mail.user');
        const pass = configService.get<string>('mail.password');
        const ignoreTLS = configService.get<boolean>('mail.ignoreTLS');
        const requireTLS = configService.get<boolean>('mail.requireTLS');


        return {
          transport: {
            host,
            port,
            secure,
            auth: { user, pass },
            ignoreTLS,
            requireTLS,
            tls: { rejectUnauthorized: false },
          },
          defaults: {
            from: `"${configService.get<string>('mail.fromName')}" <${configService.get<string>('mail.fromEmail')}>`,
          },
          template: {
            dir: resolveTemplateDir(),
            adapter: new HandlebarsAdapter(),
            options: {
              strict: true,
            },
          },

        };
      },
      inject: [ConfigService],
    }),
  ],
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
