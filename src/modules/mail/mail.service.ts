import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import axios from 'axios';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly fromName: string;
  private readonly fromEmail: string;
  private readonly sendpipeApiKey: string;
  private readonly sendpipeBaseUrl: string;
  private readonly templates = new Map<string, Handlebars.TemplateDelegate>();

  constructor(private readonly configService: ConfigService) {
    this.fromName = this.configService.get<string>('mail.fromName', 'BankApp');
    this.fromEmail = this.configService.get<string>('mail.fromEmail', 'noreply@bankapp.com');
    this.sendpipeApiKey = this.configService.get<string>('mail.sendpipeApiKey', '');
    this.sendpipeBaseUrl = this.configService.get<string>('mail.sendpipeBaseUrl', 'https://sendpipe.fregatelab.com/v1');
  }

  onModuleInit() {
    this.loadTemplates();
    if (!this.sendpipeApiKey) {
      this.logger.warn('SENDPIPE_API_KEY is not set — emails will fail');
    } else {
      this.logger.log(`Mail configured via SendPipe (from: ${this.fromEmail})`);
    }
  }

  private loadTemplates() {
    const templateDir = this.resolveTemplateDir();
    this.logger.log(`Loading email templates from: ${templateDir}`);

    try {
      const files = readdirSync(templateDir).filter((f) => f.endsWith('.hbs'));
      for (const file of files) {
        const name = file.replace('.hbs', '');
        const source = readFileSync(join(templateDir, file), 'utf-8');
        this.templates.set(name, Handlebars.compile(source));
        this.logger.debug(`Loaded template: ${name}`);
      }
      this.logger.log(`Loaded ${files.length} email templates`);
    } catch (error) {
      this.logger.error(`Failed to load email templates from ${templateDir}`, error.stack);
    }
  }

  private resolveTemplateDir(): string {
    const candidates = [
      join(process.cwd(), 'src', 'modules', 'mail', 'templates'),
      join(__dirname, 'templates'),
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

    return join(__dirname, 'templates');
  }

  private renderTemplate(templateName: string, context: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Email template "${templateName}" not found. Available: ${[...this.templates.keys()].join(', ')}`);
    }
    return template(context);
  }

  private async send(to: string | string[], subject: string, html: string): Promise<boolean> {
    const recipients = Array.isArray(to) ? to : [to];

    try {
      const response = await axios.post(
        `${this.sendpipeBaseUrl}/messages/channel`,
        {
          channel: 'email',
          from: this.fromEmail,
          to: recipients,
          subject,
          html,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-SendPipe-Key': this.sendpipeApiKey,
          },
          timeout: 10000,
        },
      );

      this.logger.debug(`SendPipe response: ${response.status}`);
      return true;
    } catch (error) {
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`SendPipe send failed (to: ${recipients.join(', ')}): ${detail}`);
      return false;
    }
  }

  async sendWelcomeEmail(to: string, data: { firstName: string; lastName: string }): Promise<boolean> {
    try {
      const html = this.renderTemplate('welcome', {
        firstName: data.firstName,
        lastName: data.lastName,
        appName: this.fromName,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, `Welcome to ${this.fromName}!`, html);
      if (sent) this.logger.log(`Welcome email sent to ${to}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}`, error.stack);
      return false;
    }
  }

  async sendOtpEmail(
    to: string,
    data: { firstName: string; otp: string; purpose: string; expiresIn: number },
  ): Promise<boolean> {
    try {
      const html = this.renderTemplate('otp', {
        firstName: data.firstName,
        otp: data.otp,
        purpose: data.purpose,
        expiresIn: data.expiresIn,
        appName: this.fromName,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, `Your ${this.fromName} Verification Code`, html);
      if (sent) this.logger.log(`OTP email sent to ${to} for ${data.purpose}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error.stack);
      return false;
    }
  }

  async sendPinResetEmail(
    to: string,
    data: { firstName: string; resetLink: string; expiresIn: number },
  ): Promise<boolean> {
    try {
      const html = this.renderTemplate('pin-reset', {
        firstName: data.firstName,
        resetLink: data.resetLink,
        expiresIn: data.expiresIn,
        appName: this.fromName,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, `Reset Your ${this.fromName} PIN`, html);
      if (sent) this.logger.log(`PIN reset email sent to ${to}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send PIN reset email to ${to}`, error.stack);
      return false;
    }
  }

  async sendTransactionEmail(
    to: string,
    data: {
      firstName: string;
      type: 'credit' | 'debit';
      amount: string;
      currency: string;
      description: string;
      reference: string;
      date: string;
      balance: string;
    },
  ): Promise<boolean> {
    try {
      const subject =
        data.type === 'credit'
          ? `Money Received - ${data.currency} ${data.amount}`
          : `Money Sent - ${data.currency} ${data.amount}`;

      const html = this.renderTemplate('transaction', {
        firstName: data.firstName,
        type: data.type,
        typeLabel: data.type === 'credit' ? 'Credit' : 'Debit',
        amount: data.amount,
        currency: data.currency,
        description: data.description,
        reference: data.reference,
        date: data.date,
        balance: data.balance,
        appName: this.fromName,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, subject, html);
      if (sent) this.logger.log(`Transaction email sent to ${to} - ${data.reference}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send transaction email to ${to}`, error.stack);
      return false;
    }
  }

  async sendSecurityAlertEmail(
    to: string,
    data: {
      firstName: string;
      alertType: string;
      description: string;
      ipAddress?: string;
      device?: string;
      location?: string;
      date: string;
    },
  ): Promise<boolean> {
    try {
      const html = this.renderTemplate('security-alert', {
        firstName: data.firstName,
        alertType: data.alertType,
        description: data.description,
        ipAddress: data.ipAddress,
        device: data.device,
        location: data.location,
        date: data.date,
        appName: this.fromName,
        supportEmail: this.fromEmail,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, `Security Alert - ${data.alertType}`, html);
      if (sent) this.logger.log(`Security alert email sent to ${to} - ${data.alertType}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send security alert email to ${to}`, error.stack);
      return false;
    }
  }

  async sendKycStatusEmail(
    to: string,
    data: {
      firstName: string;
      status: 'verified' | 'rejected' | 'pending';
      documentType: string;
      rejectionReason?: string;
    },
  ): Promise<boolean> {
    try {
      const subjects = {
        verified: 'Document Verified Successfully',
        rejected: 'Document Verification Failed',
        pending: 'Document Under Review',
      };

      const html = this.renderTemplate('kyc-status', {
        firstName: data.firstName,
        status: data.status,
        documentType: data.documentType,
        rejectionReason: data.rejectionReason,
        appName: this.fromName,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, `${this.fromName} - ${subjects[data.status]}`, html);
      if (sent) this.logger.log(`KYC status email sent to ${to} - ${data.status}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send KYC status email to ${to}`, error.stack);
      return false;
    }
  }

  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      const html = this.renderTemplate(template, {
        ...context,
        appName: this.fromName,
        year: new Date().getFullYear(),
      });
      const sent = await this.send(to, subject, html);
      if (sent) this.logger.log(`Email sent to ${to} - ${subject}`);
      return sent;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      return false;
    }
  }
}
