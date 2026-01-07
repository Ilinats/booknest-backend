import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

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

  async sendVerificationEmail(
    cfg: SmtpConfig,
    to: string,
    verifyUrl: string,
    code?: string,
  ): Promise<void> {
    try {
      const transporter = this.createTransport(cfg);
      const from = cfg.fromName
        ? `${cfg.fromName} <${cfg.fromEmail}>`
        : cfg.fromEmail;

      if (code) {
        await transporter.sendMail({
          from,
          to,
          subject: 'Your BookNest verification code',
          text: `Hi there,\n\nThis is your one time verification code for BookNest.\n\nVerification Code: ${code}\n\nThis code is only active for the next 15 minutes. Once the code expires you will have to resubmit a request for a code.\n\nKeep making awesome stuff!\nBookNest`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
              <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-bottom: 20px;">Hi there,</h2>
                <p style="color: #666; font-size: 16px; margin-bottom: 30px;">This is your one time verification code for BookNest.</p>
                
                <div style="background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                  <div style="font-size: 32px; font-weight: bold; color: #000; letter-spacing: 4px; font-family: 'Courier New', monospace;">${code}</div>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-bottom: 30px;">This code is only active for the next 15 minutes. Once the code expires you will have to resubmit a request for a code.</p>
                
                <p style="color: #333; font-size: 16px; margin-bottom: 10px;">Keep making awesome stuff!</p>
                <p style="color: #333; font-size: 16px; font-weight: bold;">BookNest</p>
              </div>
            </div>
          `,
        });
      } else {
        const htmlButton = `<a href="${verifyUrl}" style="display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">Verify Email</a>`;

        await transporter.sendMail({
          from,
          to,
          subject: 'Verify your BookNest email',
          text: `Welcome to BookNest!\n\nPlease verify your email by opening the link below.\n\n${verifyUrl}\n\nIf the button does not work, copy and paste the link into your browser.`,
          html: `<p>Welcome to <strong>BookNest</strong>!</p><p>Please verify your email:</p><p>${htmlButton}</p><p>If the button does not work, copy and paste this link: <br/><code>${verifyUrl}</code></p>`,
        });
      }
    } catch (err) {
      console.error('Email sending error details:', err);
      throw new InternalServerErrorException(
        `Failed to send email: ${err.message}`,
      );
    }
  }

  async sendPasswordResetEmail(
    cfg: SmtpConfig,
    to: string,
    resetUrl: string,
    code?: string,
  ): Promise<void> {
    try {
      const transporter = this.createTransport(cfg);
      const from = cfg.fromName
        ? `${cfg.fromName} <${cfg.fromEmail}>`
        : cfg.fromEmail;

      if (code) {
        await transporter.sendMail({
          from,
          to,
          subject: 'Your BookNest password reset code',
          text: `Hi there,\n\nThis is your password reset code for BookNest.\n\nReset Code: ${code}\n\nThis code is only active for the next 15 minutes. Once the code expires you will have to resubmit a request for a code.\n\nIf you did not request this, please ignore this email.\n\nKeep making awesome stuff!\nBookNest`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f5f5f5; padding: 20px;">
              <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <h2 style="color: #333; margin-bottom: 20px;">Hi there,</h2>
                <p style="color: #666; font-size: 16px; margin-bottom: 30px;">This is your password reset code for BookNest.</p>
                
                <div style="background: #f8f9fa; border: 2px solid #e9ecef; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
                  <div style="font-size: 32px; font-weight: bold; color: #000; letter-spacing: 4px; font-family: 'Courier New', monospace;">${code}</div>
                </div>
                
                <p style="color: #666; font-size: 14px; margin-bottom: 30px;">This code is only active for the next 15 minutes. Once the code expires you will have to resubmit a request for a code.</p>
                <p style="color: #666; font-size: 14px; margin-bottom: 30px;">If you did not request this, please ignore this email.</p>
                
                <p style="color: #333; font-size: 16px; margin-bottom: 10px;">Keep making awesome stuff!</p>
                <p style="color: #333; font-size: 16px; font-weight: bold;">BookNest</p>
              </div>
            </div>
          `,
        });
      } else {
        const htmlButton = `<a href="${resetUrl}" style="display:inline-block;padding:10px 16px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a>`;

        await transporter.sendMail({
          from,
          to,
          subject: 'Reset your BookNest password',
          text: `We received a request to reset your BookNest password.\n\nUse the link below to set a new password. If you did not request this, please ignore this email.\n\n${resetUrl}\n\nThis link will expire in 15 minutes.`,
          html: `<p>We received a request to reset your <strong>BookNest</strong> password.</p><p>Use the link below to set a new password. If you did not request this, please ignore this email.</p><p>${htmlButton}</p><p>This link will expire in 15 minutes.</p>`,
        });
      }
    } catch (err) {
      console.error('Email sending error details:', err);
      throw new InternalServerErrorException(
        `Failed to send email: ${err.message}`,
      );
    }
  }
}
