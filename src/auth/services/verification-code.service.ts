import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationCode } from '../entity/verification-code.entity';
import { VerificationType } from '../enums';
import { User } from '../../users/entity/user.entity';
import { MailService } from '../../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VerificationCodeService {
  constructor(
    @InjectRepository(VerificationCode)
    private readonly verificationCodeRepo: Repository<VerificationCode>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  private generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getExpirationTime(): Date {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 15); // 15 minutes expiration
    return now;
  }

  async createVerificationCode(
    userId: string,
    type: VerificationType,
  ): Promise<VerificationCode> {
    await this.verificationCodeRepo.update(
      { userId, type, isUsed: false },
      { isUsed: true, usedAt: new Date() },
    );

    const code = this.generateCode();
    const expiresAt = this.getExpirationTime();

    const verificationCode = this.verificationCodeRepo.create({
      userId,
      code,
      type,
      expiresAt,
    });

    return this.verificationCodeRepo.save(verificationCode);
  }

  async verifyCode(
    code: string,
    type: VerificationType,
  ): Promise<{ isValid: boolean; user?: User }> {
    const verificationCode = await this.verificationCodeRepo.findOne({
      where: { code, type, isUsed: false },
      relations: ['user'],
    });

    if (!verificationCode) {
      return { isValid: false };
    }

    if (new Date() > verificationCode.expiresAt) {
      return { isValid: false };
    }

    verificationCode.isUsed = true;
    verificationCode.usedAt = new Date();
    await this.verificationCodeRepo.save(verificationCode);

    return { isValid: true, user: verificationCode.user };
  }

  async sendVerificationEmail(user: User, code: string): Promise<void> {
    const webBaseUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const appScheme =
      this.configService.get<string>('APP_DEEP_LINK_SCHEME') || 'booknest';
    const appHost =
      this.configService.get<string>('APP_DEEP_LINK_HOST') || '://verify-email';
    const appDeepLink = `${appScheme}${appHost}?code=${code}`;

    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured');
    }

    const smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST') ?? 'smtp.gmail.com',
      port: Number(this.configService.get<string>('SMTP_PORT') ?? '465'),
      secure:
        (this.configService.get<string>('SMTP_SECURE') ?? 'true') === 'true',
      user: gmailUser,
      pass: gmailPassword,
      fromEmail: gmailUser,
    };

    const verifyUrl = `${webBaseUrl}/verify-email?code=${code}`;

    console.log('Sending verification email with config:', {
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      user: smtpConfig.user,
      to: user.email,
      code: code,
    });

    await this.mailService.sendVerificationEmail(
      smtpConfig,
      user.email,
      verifyUrl,
      appDeepLink,
      code,
    );
  }

  async sendPasswordResetEmail(user: User, code: string): Promise<void> {
    const webBaseUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const appScheme =
      this.configService.get<string>('APP_DEEP_LINK_SCHEME') || 'booknest';
    const appHost =
      this.configService.get<string>('APP_DEEP_LINK_HOST') ||
      '://reset-password';
    const appDeepLink = `${appScheme}${appHost}?code=${code}`;

    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured');
    }

    const smtpConfig = {
      host: this.configService.get<string>('SMTP_HOST') ?? 'smtp.gmail.com',
      port: Number(this.configService.get<string>('SMTP_PORT') ?? '465'),
      secure:
        (this.configService.get<string>('SMTP_SECURE') ?? 'true') === 'true',
      user: gmailUser,
      pass: gmailPassword,
      fromEmail: gmailUser,
    };

    const resetUrl = `${webBaseUrl}/reset-password?code=${code}`;

    await this.mailService.sendPasswordResetEmail(
      smtpConfig,
      user.email,
      resetUrl,
      appDeepLink,
      code,
    );
  }

  async cleanupExpiredCodes(): Promise<void> {
    await this.verificationCodeRepo.delete({
      expiresAt: { $lt: new Date() } as any,
    });
  }
}
