import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entity/user.entity';
import * as argon2 from 'argon2';
import { RefreshToken } from './entity/refresh-token.entity';
import { UserAddressService } from '../users/user-address.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly userAddressService: UserAddressService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  private smtpConfig() {
    const gmailUser = this.configService.get<string>('GMAIL_USER');
    const gmailPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');
    
    if (!gmailUser || !gmailPassword) {
      throw new Error('Gmail credentials not configured');
    }
    
    return {
      host: this.configService.get<string>('SMTP_HOST') ?? 'smtp.gmail.com',
      port: Number(this.configService.get<string>('SMTP_PORT') ?? '465'),
      secure: (this.configService.get<string>('SMTP_SECURE') ?? 'true') === 'true',
      user: gmailUser,
      pass: gmailPassword,
      fromEmail: this.configService.get<string>('FROM_EMAIL') ?? gmailUser,
      fromName: this.configService.get<string>('FROM_NAME') ?? 'BookNest',
    };
  }

  async register(dto: RegisterDto) {
    // Check if user already exists by email or username
    const existingUser = await this.usersRepository.findOne({ 
      where: [
        { email: dto.email.toLowerCase() },
        { username: dto.username }
      ]
    });
    if (existingUser) throw new ConflictException({ message: 'User already exists', code: 'USER_EXISTS' });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    
    const user: User = this.usersRepository.create({
      username: dto.username,
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      userType: dto.userType,
      avatarUrl: dto.avatarUrl ?? null,
      bio: dto.bio ?? null,
      birthDate: dto.birthDate ?? null,
      isActive: true,
    });

    const savedUser = await this.usersRepository.save(user);

    if (dto.address) {
      await this.userAddressService.create(savedUser.id, dto.address);
    }

    // Генерираме verification token и изпращаме имейл
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await this.setEmailVerificationToken(savedUser.id, verifyToken);

    const webBaseUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${webBaseUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`;

    const appScheme = this.configService.get<string>('APP_DEEP_LINK_SCHEME');
    const appHost = this.configService.get<string>('APP_DEEP_LINK_HOST');
    const appDeepLink = appScheme && appHost ? `${appScheme}${appHost}/verify-email?token=${encodeURIComponent(verifyToken)}` : undefined;

    try {
      await this.mailService.sendVerificationEmail(this.smtpConfig(), savedUser.email, verifyUrl, appDeepLink);
    } catch (error) {
      console.warn('Failed to send verification email:', error.message);
    }

    const { accessToken, refreshToken } = await this.issueTokensStateful(savedUser.id, savedUser.username, savedUser.email, undefined, undefined);
    return { user: savedUser, accessToken, refreshToken };
  }

  async login(dto: LoginDto, meta?: { ip?: string; userAgent?: string; deviceName?: string }) {
    const user = await this.verifyPassword(dto.identifier, dto.password);
    if (!user) throw new UnauthorizedException({ message: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
    await this.updateLastLogin(user.id);
    const { accessToken, refreshToken } = await this.issueTokensStateful(user.id, user.username, user.email, meta?.ip, meta?.userAgent, meta?.deviceName);
    return { user, accessToken, refreshToken };
  }

  async logout(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const token = await this.refreshTokenRepository.findOne({ where: { tokenHash: hash } });
    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await this.refreshTokenRepository.save(token);
    }
    return { message: 'Logged out' };
  }

  async logoutAll(userId: string) {
    await this.refreshTokenRepository.update({ userId }, { revokedAt: new Date() });
    return { message: 'Logged out from all devices' };
  }

  async refresh(dto: RefreshTokenDto, meta?: { ip?: string; userAgent?: string; deviceName?: string }) {
    const hash = this.hashToken(dto.refreshToken);
    const token = await this.refreshTokenRepository.findOne({ where: { tokenHash: hash } });
    if (!token || token.revokedAt || token.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });
    }

    // Проверка за reuse: ако е бил заместен, считаме опит за повторна употреба
    if (token.replacedByTokenId) {
      // Отменяме цялото семейство токени
      await this.refreshTokenRepository.update({ familyId: token.familyId }, { revokedAt: new Date() });
      throw new UnauthorizedException({ message: 'Refresh token reuse detected', code: 'REFRESH_TOKEN_REUSE' });
    }

    const user = await this.usersRepository.findOne({ where: { id: token.userId } });
    if (!user) throw new UnauthorizedException({ message: 'Invalid refresh token', code: 'INVALID_REFRESH_TOKEN' });

    // Ротация: създаваме нов refresh токен и маркираме текущия като заменен
    const { accessToken, refreshToken } = await this.issueTokensStateful(user.id, user.username, user.email, meta?.ip, meta?.userAgent, meta?.deviceName, token.familyId, token.id);

    return { accessToken, refreshToken };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60);
      await this.setPasswordResetToken(user.id, token, expires);

      const baseUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      try {
        await this.mailService.sendPasswordResetEmail(this.smtpConfig(), user.email, resetUrl);
      } catch (error) {
        console.warn('Failed to send password reset email:', error.message);
      }
    }
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    if (!dto.token || !dto.newPassword) throw new BadRequestException({ message: 'Invalid payload', code: 'INVALID_PAYLOAD' });
    await this.resetPasswordByToken(dto.token, dto.newPassword);
    return { message: 'Password has been reset.' };
  }

  async verifyEmail(token: string) {
    const user = await this.verifyEmailByToken(token);
    return { user };
  }

  async resendVerification(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) return { message: 'If that email exists, a verification was sent.' };
    const token = crypto.randomBytes(32).toString('hex');
    await this.setEmailVerificationToken(user.id, token);

    const webBaseUrl = this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${webBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    const appScheme = this.configService.get<string>('APP_DEEP_LINK_SCHEME');
    const appHost = this.configService.get<string>('APP_DEEP_LINK_HOST');
    const appDeepLink = appScheme && appHost ? `${appScheme}${appHost}/verify-email?token=${encodeURIComponent(token)}` : undefined;

    try {
      await this.mailService.sendVerificationEmail(this.smtpConfig(), user.email, verifyUrl, appDeepLink);
    } catch (error) {
      console.warn('Failed to send verification email:', error.message);
    }

    return { message: 'If that email exists, a verification was sent.' };
  }

  private async issueTokensStateful(userId: string, username: string, email: string, ip?: string, userAgent?: string, deviceName?: string, familyId?: string, replacedTokenId?: string) {
    const payload = { sub: userId, username, email };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') ?? (this.configService.get<string>('JWT_SECRET') ?? 'dev_secret_change_me') + '_refresh';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

    const rawRefreshToken = crypto.randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawRefreshToken);

    const now = Date.now();
    const expiresAt = new Date(now + this.parseDurationMs(refreshExpiresIn));

    const family = familyId ?? crypto.randomUUID();

    const entity = this.refreshTokenRepository.create({
      userId,
      tokenHash,
      familyId: family,
      replacedByTokenId: null,
      revokedAt: null,
      expiresAt,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      deviceName: deviceName ?? null,
    });

    const saved = await this.refreshTokenRepository.save(entity);

    if (replacedTokenId) {
      await this.refreshTokenRepository.update({ id: replacedTokenId }, { replacedByTokenId: saved.id });
    }

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private parseDurationMs(expr: string): number {
    const match = /^([0-9]+)([smhd])$/.exec(expr);
    if (!match) return 7 * 24 * 60 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return 7 * 24 * 60 * 60 * 1000;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private async issueTokens(userId: string, username: string, email: string) {
    const payload = { sub: userId, username, email };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET') ?? (this.configService.get<string>('JWT_SECRET') ?? 'dev_secret_change_me') + '_refresh';
    const refreshExpiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';
    const refreshToken = await this.jwtService.signAsync(payload, { secret: refreshSecret, expiresIn: refreshExpiresIn });
    return { accessToken, refreshToken };
  }

  private async verifyPassword(emailOrUsername: string, password: string): Promise<User | null> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :identifier OR user.username = :identifier', { identifier: emailOrUsername.toLowerCase() })
      .getOne();

    if (!user || !user.passwordHash) {
      return null;
    }

    const ok = await argon2.verify(user.passwordHash, password);
    return ok ? user : null;
  }

  private async setEmailVerificationToken(userId: string, token: string): Promise<void> {
    await this.usersRepository.update({ id: userId }, { emailVerificationToken: token });
  }

  private async verifyEmailByToken(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { emailVerificationToken: token } });
    if (!user) throw new BadRequestException({ message: 'Invalid token', code: 'INVALID_TOKEN' });
    user.emailVerified = true;
    user.emailVerificationToken = null;
    return this.usersRepository.save(user);
  }

  private async setPasswordResetToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.usersRepository.update({ id: userId }, { passwordResetToken: token, passwordResetExpires: expiresAt });
  }

  private async resetPasswordByToken(token: string, newPassword: string): Promise<void> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordResetToken')
      .addSelect('user.passwordResetExpires')
      .where('user.passwordResetToken = :token', { token })
      .getOne();

    if (!user || !user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
      throw new BadRequestException({ message: 'Invalid or expired token', code: 'INVALID_OR_EXPIRED_TOKEN' });
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await this.usersRepository.update({ id: user.id }, {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
  }

  private async updateLastLogin(userId: string, at: Date = new Date()): Promise<void> {
    await this.usersRepository.update({ id: userId }, { lastLogin: at });
  }
} 