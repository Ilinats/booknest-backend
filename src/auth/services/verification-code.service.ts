import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { VerificationCode } from '../entity/verification-code.entity';
import { VerificationTypeEnum } from '../enums';
import { User } from '../../users/entity/user.entity';
import { MailService } from '../../mail/mail.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class VerificationCodeService {
  private readonly logger = new Logger(VerificationCodeService.name);

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
    type: VerificationTypeEnum,
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
    type: VerificationTypeEnum,
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
    const smtpConfig = this.getSmtpConfig();
    const verifyUrl = `${webBaseUrl}/verify-email?code=${code}`;

    await this.mailService.sendVerificationEmail(
      smtpConfig,
      user.email,
      verifyUrl,
      code,
    );
  }

  async sendPasswordResetEmail(user: User, code: string): Promise<void> {
    const webBaseUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const smtpConfig = this.getSmtpConfig();
    const resetUrl = `${webBaseUrl}/reset-password?code=${code}`;

    await this.mailService.sendPasswordResetEmail(
      smtpConfig,
      user.email,
      resetUrl,
      code,
    );
  }

  private getSmtpConfig() {
    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured');
    }

    return {
      host: this.configService.get<string>('SMTP_HOST') ?? 'smtp.gmail.com',
      port: Number(this.configService.get<string>('SMTP_PORT') ?? '465'),
      secure:
        (this.configService.get<string>('SMTP_SECURE') ?? 'true') === 'true',
      user: gmailUser,
      pass: gmailPassword,
      fromEmail: this.configService.get<string>('FROM_EMAIL') ?? gmailUser,
      fromName: this.configService.get<string>('FROM_NAME') ?? 'BookNest',
    };
  }

  async cleanupExpiredCodes(): Promise<void> {
    await this.verificationCodeRepo.delete({
      expiresAt: LessThan(new Date()),
    });
  }
}
