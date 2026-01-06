import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from './dto';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entity/user.entity';
import * as argon2 from 'argon2';
import { RefreshToken } from './entity/refresh-token.entity';
import { UserAddressService } from '../user-address/user-address.service';
import { VerificationCodeService } from './services/verification-code.service';
import { VerifyEmailDto, RequestPasswordResetDto } from './dto';
import { sanitizeUser } from '../common/utils/user-sanitizer.util';
import {
  AuthResponseDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
  VerificationStatusResponseDto,
  MessageResponseDto,
} from './dto';
import { UserResponseDto } from '../users/dto';
import { AuthErrorCode, AuthErrors } from './errors/auth-errors';
import { UserType } from '../users/enums';
import { VerificationTypeEnum } from './enums';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly userAddressService: UserAddressService,
    private readonly verificationCodeService: VerificationCodeService,
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
      secure:
        (this.configService.get<string>('SMTP_SECURE') ?? 'true') === 'true',
      user: gmailUser,
      pass: gmailPassword,
      fromEmail: this.configService.get<string>('FROM_EMAIL') ?? gmailUser,
      fromName: this.configService.get<string>('FROM_NAME') ?? 'BookNest',
    };
  }

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    console.log('Registration attempt for:', {
      email: dto.email,
      username: dto.username,
    });

    const existingUser = await this.usersRepository.findOne({
      where: [{ email: dto.email.toLowerCase() }, { username: dto.username }],
    });

    if (existingUser) {
      console.log('User already exists:', {
        id: existingUser.id,
        email: existingUser.email,
        username: existingUser.username,
        existingEmail: existingUser.email === dto.email.toLowerCase(),
        existingUsername: existingUser.username === dto.username,
      });
      const error = AuthErrors[AuthErrorCode.USER_ALREADY_EXISTS];
      throw new ConflictException({ message: error.message, code: error.code });
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

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

    let savedUser: User;
    try {
      savedUser = await this.usersRepository.save(user);
      console.log('User saved successfully:', {
        id: savedUser.id,
        email: savedUser.email,
        username: savedUser.username,
      });
    } catch (error) {
      console.error('Failed to save user:', error);
      console.error('User data that failed to save:', {
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      throw error;
    }

    if (dto.address) {
      await this.userAddressService.create(savedUser.id, dto.address);
    }

    const verificationCode =
      await this.verificationCodeService.createVerificationCode(
        savedUser.id,
        VerificationTypeEnum.EMAIL_VERIFICATION,
      );

    try {
      await this.verificationCodeService.sendVerificationEmail(
        savedUser,
        verificationCode.code,
      );
      console.log(`Verification email sent successfully to ${savedUser.email}`);
    } catch (error) {
      console.error('Failed to send verification email:', error.message);
    }

    const { accessToken, refreshToken } = await this.issueTokensStateful(
      savedUser.id,
      savedUser.username || savedUser.email,
      savedUser.email,
      savedUser.userType,
    );
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.verifyPassword(dto.identifier, dto.password);
    if (!user) {
      const error = AuthErrors[AuthErrorCode.INVALID_CREDENTIALS];
      throw new UnauthorizedException({
        message: error.message,
        code: error.code,
      });
    }
    await this.updateLastLogin(user.id);
    const { accessToken, refreshToken } = await this.issueTokensStateful(
      user.id,
      user.username || user.email,
      user.email,
      user.userType,
    );
    return { accessToken, refreshToken };
  }

  async logout(refreshToken: string): Promise<LogoutResponseDto> {
    const hash = this.hashToken(refreshToken);
    const token = await this.refreshTokenRepository.findOne({
      where: { tokenHash: hash },
    });
    if (token && !token.revokedAt) {
      token.revokedAt = new Date();
      await this.refreshTokenRepository.save(token);
    }
    return { message: 'Logged out' };
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    const hash = this.hashToken(dto.refreshToken);
    const token = await this.refreshTokenRepository.findOne({
      where: { tokenHash: hash },
    });
    if (!token || token.revokedAt || token.expiresAt.getTime() < Date.now()) {
      const error = AuthErrors[AuthErrorCode.INVALID_REFRESH_TOKEN];
      throw new UnauthorizedException({
        message: error.message,
        code: error.code,
      });
    }

    if (token.replacedByTokenId) {
      await this.refreshTokenRepository.update(
        { familyId: token.familyId },
        { revokedAt: new Date() },
      );
      const error = AuthErrors[AuthErrorCode.REFRESH_TOKEN_REUSE];
      throw new UnauthorizedException({
        message: error.message,
        code: error.code,
      });
    }

    const user = await this.usersRepository.findOne({
      where: { id: token.userId },
    });
    if (!user) {
      const error = AuthErrors[AuthErrorCode.INVALID_REFRESH_TOKEN];
      throw new UnauthorizedException({
        message: error.message,
        code: error.code,
      });
    }

    const { accessToken, refreshToken } = await this.issueTokensStateful(
      user.id,
      user.username || user.email,
      user.email,
      user.userType,
      token.familyId,
      token.id,
    );

    return { accessToken, refreshToken };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 1000 * 60 * 60);
      await this.setPasswordResetToken(user.id, token, expires);

      const baseUrl =
        this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;

      try {
        await this.mailService.sendPasswordResetEmail(
          this.smtpConfig(),
          user.email,
          resetUrl,
        );
      } catch (error) {
        console.warn('Failed to send password reset email:', error.message);
      }
    }
    return { message: 'If that email exists, a reset link has been sent.' };
  }

  async verifyEmail(token: string): Promise<{ user: UserResponseDto }> {
    const user = await this.verifyEmailByToken(token);
    const sanitizedUser = sanitizeUser(user);
    return { user: sanitizedUser };
  }

  async getVerificationStatus(
    userId: string,
  ): Promise<VerificationStatusResponseDto> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      const error = AuthErrors[AuthErrorCode.USER_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    return {
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    };
  }

  async resendVerification(email: string): Promise<MessageResponseDto> {
    const user = await this.usersService.findByEmail(email);
    if (!user)
      return { message: 'If that email exists, a verification was sent.' };
    const token = crypto.randomBytes(32).toString('hex');
    await this.setEmailVerificationToken(user.id, token);

    const webBaseUrl =
      this.configService.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${webBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;

    const appScheme =
      this.configService.get<string>('APP_DEEP_LINK_SCHEME') || 'booknest';
    const appHost =
      this.configService.get<string>('APP_DEEP_LINK_HOST') || '://verify-email';
    const appDeepLink = `${appScheme}${appHost}?token=${encodeURIComponent(token)}`;

    try {
      await this.mailService.sendVerificationEmail(
        this.smtpConfig(),
        user.email,
        verifyUrl,
        appDeepLink,
      );
    } catch (error) {
      console.error('Failed to send verification email:', error.message);
      console.error('SMTP Config:', {
        host: this.smtpConfig().host,
        port: this.smtpConfig().port,
        secure: this.smtpConfig().secure,
        user: this.smtpConfig().user,
        fromEmail: this.smtpConfig().fromEmail,
      });
    }

    return { message: 'If that email exists, a verification was sent.' };
  }

  private async issueTokensStateful(
    userId: string,
    username: string,
    email: string,
    userType: UserType,
    familyId?: string,
    replacedTokenId?: string,
  ) {
    const payload = { sub: userId, username, email, userType };
    const accessToken = await this.jwtService.signAsync(payload);

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ??
      (this.configService.get<string>('JWT_SECRET') ?? 'dev_secret_change_me') +
        '_refresh';
    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN') ?? '7d';

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
    });

    const saved = await this.refreshTokenRepository.save(entity);

    if (replacedTokenId) {
      await this.refreshTokenRepository.update(
        { id: replacedTokenId },
        { replacedByTokenId: saved.id },
      );
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

  private async verifyPassword(
    emailOrUsername: string,
    password: string,
  ): Promise<User | null> {
    const user = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :identifier OR user.username = :identifier', {
        identifier: emailOrUsername.toLowerCase(),
      })
      .getOne();

    if (!user || !user.passwordHash) {
      return null;
    }

    const ok = await argon2.verify(user.passwordHash, password);
    return ok ? user : null;
  }

  private async setEmailVerificationToken(
    userId: string,
    token: string,
  ): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      { emailVerificationToken: token },
    );
  }

  private async verifyEmailByToken(token: string): Promise<User> {
    const user = await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
    });
    if (!user) {
      const error = AuthErrors[AuthErrorCode.INVALID_VERIFICATION_CODE];
      throw new BadRequestException({
        message: error.message,
        code: error.code,
      });
    }
    user.emailVerified = true;
    user.emailVerificationToken = null;
    return this.usersRepository.save(user);
  }

  private async setPasswordResetToken(
    userId: string,
    token: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      { passwordResetToken: token, passwordResetExpires: expiresAt },
    );
  }

  private async updateLastLogin(
    userId: string,
    at: Date = new Date(),
  ): Promise<void> {
    await this.usersRepository.update({ id: userId }, { lastLogin: at });
  }

  async verifyEmailWithCode(
    dto: VerifyEmailDto,
  ): Promise<{ message: string; user: UserResponseDto }> {
    const result = await this.verificationCodeService.verifyCode(
      dto.code,
      VerificationTypeEnum.EMAIL_VERIFICATION,
    );

    if (!result.isValid || !result.user) {
      const error = AuthErrors[AuthErrorCode.INVALID_VERIFICATION_CODE];
      throw new UnauthorizedException({
        message: 'Invalid or expired verification code',
        code: error.code,
      });
    }

    await this.usersRepository.update(
      { id: result.user.id },
      { emailVerified: true },
    );

    const sanitizedUser = sanitizeUser(result.user);
    return {
      message: 'Email verified successfully',
      user: sanitizedUser,
    };
  }

  async requestPasswordReset(
    dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      return {
        message:
          'If an account with that email exists, a password reset code has been sent',
      };
    }

    const verificationCode =
      await this.verificationCodeService.createVerificationCode(
        user.id,
        VerificationTypeEnum.PASSWORD_RESET,
      );

    await this.verificationCodeService.sendPasswordResetEmail(
      user,
      verificationCode.code,
    );

    return {
      message:
        'If an account with that email exists, a password reset code has been sent',
    };
  }

  async resetPasswordWithCode(
    dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    const result = await this.verificationCodeService.verifyCode(
      dto.code,
      VerificationTypeEnum.PASSWORD_RESET,
    );

    if (!result.isValid || !result.user) {
      const error = AuthErrors[AuthErrorCode.INVALID_VERIFICATION_CODE];
      throw new UnauthorizedException({
        message: 'Invalid or expired reset code',
        code: error.code,
      });
    }

    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
    });

    await this.usersRepository.update({ id: result.user.id }, { passwordHash });

    return {
      message: 'Password reset successfully',
    };
  }

  async resendVerificationCode(email: string): Promise<{ message: string }> {
    console.log('Resend verification code for:', email);

    const user = await this.usersRepository.findOne({ where: { email } });

    if (!user) {
      console.log('User not found for email:', email);
      const error = AuthErrors[AuthErrorCode.USER_NOT_FOUND];
      throw new NotFoundException({ message: error.message, code: error.code });
    }

    if (user.emailVerified) {
      console.log('Email already verified for:', email);
      const error = AuthErrors[AuthErrorCode.EMAIL_NOT_VERIFIED];
      throw new BadRequestException({
        message: 'Email is already verified',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    }

    console.log('Creating verification code for user:', user.id);

    const verificationCode =
      await this.verificationCodeService.createVerificationCode(
        user.id,
        VerificationTypeEnum.EMAIL_VERIFICATION,
      );

    console.log('Verification code created:', verificationCode.code);

    try {
      await this.verificationCodeService.sendVerificationEmail(
        user,
        verificationCode.code,
      );
      console.log('Verification email sent successfully to:', email);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw error;
    }

    return {
      message: 'Verification code sent successfully',
    };
  }

  async checkUsernameAvailability(username: string): Promise<{
    available: boolean;
    message: string;
  }> {
    const existingUser = await this.usersRepository.findOne({
      where: { username },
    });

    if (existingUser) {
      return {
        available: false,
        message: 'Username is already taken',
      };
    }

    return {
      available: true,
      message: 'Username is available',
    };
  }

  async checkEmailAvailability(email: string): Promise<{
    available: boolean;
    message: string;
  }> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    if (existingUser) {
      return {
        available: false,
        message: 'Email is already registered',
      };
    }

    return {
      available: true,
      message: 'Email is available',
    };
  }
}
