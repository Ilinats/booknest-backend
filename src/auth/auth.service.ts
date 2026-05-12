import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
  RequestPasswordResetDto,
  AuthResponseDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
  VerificationStatusResponseDto,
} from './dto';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entity/user.entity';
import * as argon2 from 'argon2';
import { RefreshToken } from './entity/refresh-token.entity';
import { UserAddressService } from '../user-address/user-address.service';
import { VerificationCodeService } from './services/verification-code.service';
import { sanitizeUser } from '../common/utils/user-sanitizer.util';
import { UserResponseDto } from '../users/dto';
import { AuthErrors } from './errors/auth-errors';
import { UserType } from '../users/enums';
import { VerificationTypeEnum } from './enums';
import { ConflictException } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ms = require('ms') as (value: string) => number;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly userAddressService: UserAddressService,
    private readonly verificationCodeService: VerificationCodeService,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    const existingUser = await this.findExistingUser(
      dto.email.toLowerCase(),
      dto.username,
    );
    if (existingUser) {
      throw new ConflictException(AuthErrors.USER_ALREADY_EXISTS);
    }

    const passwordHash = await this.hashPassword(dto.password);
    const savedUser = await this.createUser(dto, passwordHash);

    if (dto.address) {
      await this.userAddressService.create(savedUser.id, dto.address);
    }

    await this.sendVerificationCode(savedUser);
    return this.generateTokens(savedUser);
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.verifyPassword(dto.identifier, dto.password);
    if (!user) {
      throw new UnauthorizedException(AuthErrors.INVALID_CREDENTIALS);
    }

    await this.updateLastLogin(user.id);
    return this.generateTokens(user);
  }

  async logout(refreshToken: string): Promise<LogoutResponseDto> {
    const tokenHash = this.hashToken(refreshToken);
    await this.refreshTokenRepository.delete({ tokenHash });
    return { message: 'Logged out' };
  }

  async refresh(dto: RefreshTokenDto): Promise<RefreshTokenResponseDto> {
    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      `${this.configService.get<string>('JWT_SECRET') ?? 'dev_secret_change_me'}_refresh`;
    let payload: {
      sub: string;
      username?: string;
      email: string;
      userType: UserType;
    };

    try {
      payload = await this.jwtService.verifyAsync<{
        sub: string;
        username?: string;
        email: string;
        userType: UserType;
      }>(dto.refreshToken, { secret: refreshSecret });
    } catch {
      throw new UnauthorizedException(AuthErrors.INVALID_REFRESH_TOKEN);
    }

    const tokenHash = this.hashToken(dto.refreshToken);
    const token = await this.refreshTokenRepository.findOne({
      where: { tokenHash },
    });

    if (!token || token.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(AuthErrors.INVALID_REFRESH_TOKEN);
    }

    const user = await this.findUserById(payload.sub);
    if (!user) {
      throw new NotFoundException(AuthErrors.USER_NOT_FOUND);
    }

    await this.refreshTokenRepository.delete({ id: token.id });
    return this.generateTokens(user);
  }

  async verifyEmailWithCode(
    dto: VerifyEmailDto,
  ): Promise<{ message: string; user: UserResponseDto }> {
    const result = await this.verificationCodeService.verifyCode(
      dto.code,
      VerificationTypeEnum.EMAIL_VERIFICATION,
    );

    if (!result.isValid || !result.user) {
      throw new UnauthorizedException(AuthErrors.INVALID_VERIFICATION_CODE);
    }

    await this.usersRepository.update(
      { id: result.user.id },
      { emailVerified: true },
    );

    return {
      message: 'Email verified successfully',
      user: sanitizeUser(result.user),
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
      throw new UnauthorizedException(AuthErrors.INVALID_VERIFICATION_CODE);
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.usersRepository.update({ id: result.user.id }, { passwordHash });

    return { message: 'Password reset successfully' };
  }

  async resendVerificationCode(email: string): Promise<{ message: string }> {
    const user = await this.usersRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException(AuthErrors.USER_NOT_FOUND);
    }

    if (user.emailVerified) {
      throw new BadRequestException(AuthErrors.EMAIL_ALREADY_VERIFIED);
    }

    const verificationCode =
      await this.verificationCodeService.createVerificationCode(
        user.id,
        VerificationTypeEnum.EMAIL_VERIFICATION,
      );

    try {
      await this.verificationCodeService.sendVerificationEmail(
        user,
        verificationCode.code,
      );
    } catch (error) {
      this.logger.error('Failed to send verification email:', error);
      throw error;
    }

    return { message: 'Verification code sent successfully' };
  }

  // Backwards-compatible wrappers for older tests
  async verifyEmail(token: string): Promise<{ message: string }> {
    return this.verifyEmailWithCode({ code: token } as any);
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    return this.resendVerificationCode(email);
  }

  async getVerificationStatus(
    userId: string,
  ): Promise<VerificationStatusResponseDto> {
    const user = await this.findUserById(userId);
    if (!user) {
      throw new NotFoundException(AuthErrors.USER_NOT_FOUND);
    }

    return {
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
    };
  }

  async checkUsernameAvailability(username: string): Promise<{
    available: boolean;
    message: string;
  }> {
    const existingUser = await this.usersRepository.findOne({
      where: { username },
    });

    return {
      available: !existingUser,
      message: existingUser
        ? 'Username is already taken'
        : 'Username is available',
    };
  }

  async checkEmailAvailability(email: string): Promise<{
    available: boolean;
    message: string;
  }> {
    const existingUser = await this.usersRepository.findOne({
      where: { email: email.toLowerCase() },
    });

    return {
      available: !existingUser,
      message: existingUser
        ? 'Email is already registered'
        : 'Email is available',
    };
  }

  private async generateTokens(
    user: User,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: user.id,
      username: user.username || user.email,
      email: user.email,
      userType: user.userType,
    };

    const refreshExpiresIn =
      this.configService.get<string>('JWT_REFRESH_EXPIRES_IN')?.trim() ||
      '7d';

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      `${this.configService.get<string>('JWT_SECRET') ?? 'dev_secret_change_me'}_refresh`;

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: refreshExpiresIn,
      }),
    ]);

    await this.saveRefreshToken(user.id, refreshToken, refreshExpiresIn);

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(
    userId: string,
    refreshToken: string,
    expiresIn: string,
  ): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const spec = expiresIn.trim();
    let expiresMs: number;
    try {
      expiresMs = ms(spec);
    } catch {
      expiresMs = ms('7d');
    }
    if (typeof expiresMs !== 'number' || !Number.isFinite(expiresMs) || expiresMs <= 0) {
      expiresMs = ms('7d');
    }
    const expiresAt = new Date(Date.now() + expiresMs);

    await this.refreshTokenRepository.save({
      userId,
      tokenHash,
      expiresAt,
    });
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

    try {
      const ok = await argon2.verify(user.passwordHash, password);
      return ok ? user : null;
    } catch (err) {
      this.logger.warn(
        `argon2.verify failed for user id=${user.id}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async findExistingUser(
    email: string,
    username: string,
  ): Promise<User | null> {
    return this.usersRepository.findOne({
      where: [{ email }, { username }],
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  private async createUser(
    dto: RegisterDto,
    passwordHash: string,
  ): Promise<User> {
    const user = this.usersRepository.create({
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

    try {
      return await this.usersRepository.save(user);
    } catch (error) {
      this.logger.error('Failed to save user:', error);
      throw error;
    }
  }

  private async sendVerificationCode(user: User): Promise<void> {
    try {
      const verificationCode =
        await this.verificationCodeService.createVerificationCode(
          user.id,
          VerificationTypeEnum.EMAIL_VERIFICATION,
        );

      await this.verificationCodeService.sendVerificationEmail(
        user,
        verificationCode.code,
      );
    } catch (error) {
      this.logger.warn('Failed to send verification email:', error);
    }
  }

  private async findUserById(userId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id: userId } });
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await this.usersRepository.update(
      { id: userId },
      { lastLogin: new Date() },
    );
  }
}
