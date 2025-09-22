import { Injectable, InternalServerErrorException } from '@nestjs/common';
import nodemailer from 'nodemailer';

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromEmail: string;
  fromName?: string;
}

@Injectable()
export class MailService {
  private createTransport(cfg: SmtpConfig) {
    return nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
  }

  async sendPasswordResetEmail(cfg: SmtpConfig, to: string, resetUrl: string): Promise<void> {
    try {
      const transporter = this.createTransport(cfg);
      const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail;
      await transporter.sendMail({
        from,
        to,
        subject: 'Reset your BookNest password',
        text: `We received a request to reset your BookNest password.\n\nUse the link below to set a new password. If you did not request this, please ignore this email.\n\n${resetUrl}\n\nThis link will expire soon.`,
        html: `<p>We received a request to reset your <strong>BookNest</strong> password.</p><p>Use the link below to set a new password. If you did not request this, please ignore this email.</p><p><a href="${resetUrl}">Reset Password</a></p><p>This link will expire soon.</p>`,
      });
    } catch (err) {
      throw new InternalServerErrorException('Failed to send email');
    }
  }

  async sendVerificationEmail(cfg: SmtpConfig, to: string, verifyUrl: string, appDeepLinkUrl?: string): Promise<void> {
    try {
      const transporter = this.createTransport(cfg);
      const from = cfg.fromName ? `${cfg.fromName} <${cfg.fromEmail}>` : cfg.fromEmail;
      const primaryUrl = appDeepLinkUrl || verifyUrl;
      const htmlButton = `<a href="${primaryUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a>`;
      const altLink = appDeepLinkUrl ? `<p>If the button doesn't open the app, <a href="${verifyUrl}">tap here</a> instead.</p>` : '';
      await transporter.sendMail({
        from,
        to,
        subject: 'Verify your BookNest email',
        text: `Welcome to BookNest!\n\nPlease verify your email by opening the link below.\n\n${primaryUrl}\n\nIf the button does not work, copy and paste the link into your browser.`,
        html: `<p>Welcome to <strong>BookNest</strong>!</p><p>Please verify your email:</p><p>${htmlButton}</p>${altLink}<p>If the button does not work, copy and paste this link: <br/><code>${primaryUrl}</code></p>`,
      });
    } catch (err) {
      throw new InternalServerErrorException('Failed to send email');
    }
  }
} 