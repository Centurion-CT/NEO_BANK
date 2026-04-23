import { Injectable, Logger } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';

/**
 * Mail Service
 *
 * Provides email sending functionality with templates.
 * All emails use Handlebars templates for consistent formatting.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromName: string;
  private readonly fromEmail: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.fromName = this.configService.get<string>('mail.fromName', 'BankApp');
    this.fromEmail = this.configService.get<string>('mail.fromEmail', 'noreply@bankapp.com');
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(to: string, data: { firstName: string; lastName: string }): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Welcome to ${this.fromName}!`,
        template: 'welcome',
        context: {
          firstName: data.firstName,
          lastName: data.lastName,
          appName: this.fromName,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Welcome email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send welcome email to ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Send OTP verification email
   */
  async sendOtpEmail(
    to: string,
    data: { firstName: string; otp: string; purpose: string; expiresIn: number },
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Your ${this.fromName} Verification Code`,
        template: 'otp',
        context: {
          firstName: data.firstName,
          otp: data.otp,
          purpose: data.purpose,
          expiresIn: data.expiresIn,
          appName: this.fromName,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`OTP email sent to ${to} for ${data.purpose}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send OTP email to ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Send PIN reset email
   */
  async sendPinResetEmail(
    to: string,
    data: { firstName: string; resetLink: string; expiresIn: number },
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject: `Reset Your ${this.fromName} PIN`,
        template: 'pin-reset',
        context: {
          firstName: data.firstName,
          resetLink: data.resetLink,
          expiresIn: data.expiresIn,
          appName: this.fromName,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`PIN reset email sent to ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send PIN reset email to ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Send transaction notification email
   */
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

      await this.mailerService.sendMail({
        to,
        subject,
        template: 'transaction',
        context: {
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
        },
      });
      this.logger.log(`Transaction email sent to ${to} - ${data.reference}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send transaction email to ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Send security alert email
   */
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
      await this.mailerService.sendMail({
        to,
        subject: `Security Alert - ${data.alertType}`,
        template: 'security-alert',
        context: {
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
        },
      });
      this.logger.log(`Security alert email sent to ${to} - ${data.alertType}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send security alert email to ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Send KYC status update email
   */
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

      await this.mailerService.sendMail({
        to,
        subject: `${this.fromName} - ${subjects[data.status]}`,
        template: 'kyc-status',
        context: {
          firstName: data.firstName,
          status: data.status,
          documentType: data.documentType,
          rejectionReason: data.rejectionReason,
          appName: this.fromName,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`KYC status email sent to ${to} - ${data.status}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send KYC status email to ${to}`, error.stack);
      return false;
    }
  }

  /**
   * Send generic email with custom template
   */
  async sendEmail(
    to: string,
    subject: string,
    template: string,
    context: Record<string, unknown>,
  ): Promise<boolean> {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        template,
        context: {
          ...context,
          appName: this.fromName,
          year: new Date().getFullYear(),
        },
      });
      this.logger.log(`Email sent to ${to} - ${subject}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}`, error.stack);
      return false;
    }
  }
}
