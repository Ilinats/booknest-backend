import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { UserAddressService } from '../user-address/user-address.service';
import { VerificationCodeService } from './services/verification-code.service';
import { User } from '../users/entity/user.entity';
import { RefreshToken } from './entity/refresh-token.entity';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ForgotPasswordDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserType } from '../users/enums';

// Mock argon2 to avoid using the native implementation in unit tests
const argon2Verify = jest.fn();
jest.mock('argon2', () => ({
  __esModule: true,
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: (...args: unknown[]) => argon2Verify(...args),
}));

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: MockRepo<User>;
  let refreshTokenRepository: MockRepo<RefreshToken>;
  let userAddressService: jest.Mocked<UserAddressService>;
  let verificationCodeService: jest.Mocked<VerificationCodeService>;
  let usersService: jest.Mocked<UsersService>;
  let mailService: jest.Mocked<MailService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: {
            findByEmail: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('access-token'),
          },
        },
        {
          provide: MailService,
          useValue: {
            sendPasswordResetEmail: jest.fn(),
            sendVerificationEmail: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: UserAddressService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: VerificationCodeService,
          useValue: {
            createVerificationCode: jest.fn(),
            sendVerificationEmail: jest.fn(),
            verifyCode: jest.fn(),
            sendPasswordResetEmail: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: createMockRepo(),
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: createMockRepo(),
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersRepository = module.get(getRepositoryToken(User));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    userAddressService = module.get(UserAddressService);
    verificationCodeService = module.get(VerificationCodeService);
    usersService = module.get(UsersService);
    mailService = module.get(MailService);
    configService = module.get(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    const baseRegisterDto: RegisterDto = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'Password123',
      firstName: 'Test',
      lastName: 'User',
      userType: UserType.READER,
    };

    it('should throw ConflictException if user already exists', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'user-1' } as User);

      await expect(service.register(baseRegisterDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(usersRepository.save).not.toHaveBeenCalled();
    });

    it('should create a new user and return tokens', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const createdUser: User = {
        id: 'user-1',
        username: baseRegisterDto.username,
        email: baseRegisterDto.email.toLowerCase(),
        userType: baseRegisterDto.userType,
      } as any;

      usersRepository.create.mockReturnValue(createdUser);
      usersRepository.save.mockResolvedValue(createdUser);

      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);

      const issueTokensSpy = jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      const result = await service.register(baseRegisterDto);

      expect(usersRepository.create).toHaveBeenCalled();
      expect(usersRepository.save).toHaveBeenCalledWith(createdUser);
      expect(userAddressService.create).not.toHaveBeenCalled();
      expect(verificationCodeService.createVerificationCode).toHaveBeenCalled();
      expect(verificationCodeService.sendVerificationEmail).toHaveBeenCalled();
      expect(issueTokensSpy).toHaveBeenCalledWith(
        createdUser.id,
        createdUser.username,
        createdUser.email,
        createdUser.userType,
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should call userAddressService.create when dto.address is provided', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      const createdUser: User = {
        id: 'user-1',
        username: baseRegisterDto.username,
        email: baseRegisterDto.email.toLowerCase(),
        userType: baseRegisterDto.userType,
      } as any;
      usersRepository.create.mockReturnValue(createdUser);
      usersRepository.save.mockResolvedValue(createdUser);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);
      verificationCodeService.sendVerificationEmail.mockResolvedValue(
        undefined,
      );
      jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      await service.register({
        ...baseRegisterDto,
        address: {
          city: 'Sofia',
          country: 'BG',
          postalCode: '1000',
          street: 'Main',
        } as any,
      });

      expect(userAddressService.create).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ city: 'Sofia' }),
      );
    });

    it('should rethrow when usersRepository.save throws', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockReturnValue({} as any);
      usersRepository.save.mockRejectedValue(new Error('DB error'));

      await expect(service.register(baseRegisterDto)).rejects.toThrow(
        'DB error',
      );
    });

    it('should return tokens when sendVerificationEmail throws', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      const createdUser: User = {
        id: 'user-1',
        username: baseRegisterDto.username,
        email: baseRegisterDto.email.toLowerCase(),
        userType: baseRegisterDto.userType,
      } as any;
      usersRepository.create.mockReturnValue(createdUser);
      usersRepository.save.mockResolvedValue(createdUser);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);
      verificationCodeService.sendVerificationEmail.mockRejectedValue(
        new Error('SMTP error'),
      );
      jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      const result = await service.register(baseRegisterDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
    });
  });

  describe('login', () => {
    const loginDto: LoginDto = {
      identifier: 'test@example.com',
      password: 'Password123',
    };

    it('should throw UnauthorizedException when credentials are invalid', async () => {
      jest
        .spyOn<any, any>(service as any, 'verifyPassword')
        .mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should return tokens when credentials are valid', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        userType: UserType.READER,
      } as any;

      jest
        .spyOn<any, any>(service as any, 'verifyPassword')
        .mockResolvedValue(user);

      const updateLastLoginSpy = jest
        .spyOn<any, any>(service as any, 'updateLastLogin')
        .mockResolvedValue(undefined);

      const issueTokensSpy = jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      const result = await service.login(loginDto);

      expect(updateLastLoginSpy).toHaveBeenCalledWith(user.id);
      expect(issueTokensSpy).toHaveBeenCalledWith(
        user.id,
        user.username,
        user.email,
        user.userType,
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should use username when email is missing (user.username || user.email)', async () => {
      const user: User = {
        id: 'user-1',
        email: '',
        username: 'testuser',
        userType: UserType.READER,
      } as any;
      jest
        .spyOn<any, any>(service as any, 'verifyPassword')
        .mockResolvedValue(user);
      jest
        .spyOn<any, any>(service as any, 'updateLastLogin')
        .mockResolvedValue(undefined);
      const issueTokensSpy = jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      await service.login(loginDto);

      expect(issueTokensSpy).toHaveBeenCalledWith(
        user.id,
        'testuser',
        '',
        user.userType,
      );
    });

    it('should return tokens when verifyPassword returns user (real verifyPassword path)', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        userType: UserType.READER,
        passwordHash: 'hashed',
      } as any;
      const chain = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      };
      usersRepository.createQueryBuilder.mockReturnValue(chain);
      argon2Verify.mockResolvedValue(true);
      usersRepository.update.mockResolvedValue({} as any);
      jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      const result = await service.login(loginDto);

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        expect.objectContaining({ lastLogin: expect.any(Date) }),
      );
    });

    it('should throw when verifyPassword returns null (wrong password)', async () => {
      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: 'hashed',
      } as any;
      const chain = {
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      };
      usersRepository.createQueryBuilder.mockReturnValue(chain);
      argon2Verify.mockResolvedValue(false);

      await expect(service.login(loginDto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('should revoke token when found and not revoked', async () => {
      const token: RefreshToken = {
        id: 'token-1',
        tokenHash: 'hash',
        revokedAt: null,
      } as any;
      refreshTokenRepository.findOne.mockResolvedValue(token);
      refreshTokenRepository.save.mockResolvedValue(token);

      const result = await service.logout('raw-token');

      expect(result.message).toBe('Logged out');
      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('should return message when token not found', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      const result = await service.logout('unknown-token');

      expect(result.message).toBe('Logged out');
      expect(refreshTokenRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('refresh', () => {
    const dto: RefreshTokenDto = {
      refreshToken: 'raw-refresh-token',
    };

    it('should throw UnauthorizedException when refresh token not found', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token is revoked or expired', async () => {
      const token: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        familyId: 'family-1',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 1000 * 60),
        createdAt: new Date(),
      } as any;

      refreshTokenRepository.findOne.mockResolvedValue(token);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when token reuse is detected', async () => {
      const token: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        familyId: 'family-1',
        replacedByTokenId: 'token-2',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
        createdAt: new Date(),
      } as any;

      refreshTokenRepository.findOne.mockResolvedValue(token);
      refreshTokenRepository.update.mockResolvedValue({} as any);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should return new tokens when refresh token is valid', async () => {
      const token: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        familyId: 'family-1',
        replacedByTokenId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
        createdAt: new Date(),
      } as any;

      const user: User = {
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        userType: UserType.READER,
      } as any;

      refreshTokenRepository.findOne.mockResolvedValue(token);
      usersRepository.findOne.mockResolvedValue(user);

      const issueTokensSpy = jest
        .spyOn<any, any>(service as any, 'issueTokensStateful')
        .mockResolvedValue({
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        });

      const result = await service.refresh(dto);

      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { id: token.userId },
      });
      expect(issueTokensSpy).toHaveBeenCalledWith(
        user.id,
        user.username,
        user.email,
        user.userType,
        token.familyId,
        token.id,
      );
      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UnauthorizedException when token is expired', async () => {
      const token: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        familyId: 'family-1',
        replacedByTokenId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
      } as any;
      refreshTokenRepository.findOne.mockResolvedValue(token);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found for valid token', async () => {
      const token: RefreshToken = {
        id: 'token-1',
        userId: 'user-1',
        tokenHash: 'hash',
        familyId: 'family-1',
        replacedByTokenId: null,
        revokedAt: null,
        expiresAt: new Date(Date.now() + 1000 * 60),
        createdAt: new Date(),
      } as any;
      refreshTokenRepository.findOne.mockResolvedValue(token);
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });
  });

  describe('forgotPassword', () => {
    const dto: ForgotPasswordDto = { email: 'user@example.com' };

    it('returns generic message when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null as any);

      const result = await service.forgotPassword(dto);

      expect(result.message).toContain('If that email exists');
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('creates reset token and attempts to send email when user exists', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'user@example.com',
      } as any);
      usersRepository.update.mockResolvedValue({} as any);
      configService.get.mockImplementation((key: string) => {
        if (key === 'APP_URL') return 'http://localhost:3000';
        return null;
      });

      const result = await service.forgotPassword(dto);

      expect(result.message).toContain('If that email exists');
      expect(usersRepository.update).toHaveBeenCalled();
    });
  });

  describe('getVerificationStatus', () => {
    it('throws NotFoundException when user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getVerificationStatus('user-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns verification status when user exists', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
        isActive: true,
      } as any;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.getVerificationStatus('user-1');

      expect(result).toEqual({
        userId: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
        isActive: true,
      });
    });
  });

  describe('checkUsernameAvailability', () => {
    it('returns not available when user exists', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'user-1' } as any);

      const result = await service.checkUsernameAvailability('user1');

      expect(result.available).toBe(false);
    });

    it('returns available when user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.checkUsernameAvailability('user1');

      expect(result.available).toBe(true);
    });
  });

  describe('checkEmailAvailability', () => {
    it('returns not available when user exists', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'user-1' } as any);

      const result = await service.checkEmailAvailability('user@example.com');

      expect(result.available).toBe(false);
    });

    it('returns available when user does not exist', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.checkEmailAvailability('user@example.com');

      expect(result.available).toBe(true);
    });
  });

  describe('requestPasswordReset', () => {
    const dto: RequestPasswordResetDto = { email: 'user@example.com' };

    it('returns generic message when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.requestPasswordReset(dto);

      expect(result.message).toContain('If an account with that email exists');
      expect(
        verificationCodeService.createVerificationCode,
      ).not.toHaveBeenCalled();
    });

    it('creates verification code and sends email when user exists', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
      } as any;
      usersRepository.findOne.mockResolvedValue(user);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);

      const result = await service.requestPasswordReset(dto);

      expect(result.message).toContain('If an account with that email exists');
      expect(verificationCodeService.createVerificationCode).toHaveBeenCalled();
      expect(verificationCodeService.sendPasswordResetEmail).toHaveBeenCalled();
    });
  });

  describe('resetPasswordWithCode', () => {
    const dto: ResetPasswordDto = {
      code: '123456',
      newPassword: 'NewPass123',
    };

    it('throws UnauthorizedException when code is invalid', async () => {
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: false,
        user: null,
      } as any);

      await expect(service.resetPasswordWithCode(dto)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('updates password when code is valid', async () => {
      const user: User = { id: 'user-1' } as any;
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: true,
        user,
      } as any);
      usersRepository.update.mockResolvedValue({} as any);

      const result = await service.resetPasswordWithCode(dto);

      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
      expect(result.message).toContain('Password reset successfully');
    });
  });

  describe('verifyEmail (by token string)', () => {
    it('throws BadRequestException when token is invalid', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('returns sanitized user when token is valid', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
        emailVerified: false,
        emailVerificationToken: 'valid-token',
      } as any;
      usersRepository.findOne.mockResolvedValue(user);
      usersRepository.save.mockImplementation(async (u: any) => u);

      const result = await service.verifyEmail('valid-token');

      expect(result.user).toBeDefined();
      expect(result.user.id).toBe('user-1');
      expect(usersRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerified: true,
          emailVerificationToken: null,
        }),
      );
    });
  });

  describe('verifyEmailWithCode', () => {
    it('throws UnauthorizedException when code is invalid or expired', async () => {
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: false,
        user: null,
      } as any);

      await expect(
        service.verifyEmailWithCode({ code: '000000' } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('updates user emailVerified and returns message and user when code valid', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
        username: 'user1',
      } as any;
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: true,
        user,
      } as any);
      usersRepository.update.mockResolvedValue({} as any);

      const result = await service.verifyEmailWithCode({
        code: '123456',
      } as any);

      expect(result.message).toBe('Email verified successfully');
      expect(result.user).toBeDefined();
      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        { emailVerified: true },
      );
    });
  });

  describe('resendVerification (legacy token-based)', () => {
    it('returns message when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null as any);

      const result = await service.resendVerification('nobody@example.com');

      expect(result.message).toContain('If that email exists');
    });

    it('sends verification email when user found', async () => {
      const user = { id: 'user-1', email: 'user@example.com' } as any;
      usersService.findByEmail.mockResolvedValue(user);
      usersRepository.update.mockResolvedValue({} as any);
      configService.get.mockImplementation((key: string) => {
        if (key === 'GMAIL_USER') return 'user';
        if (key === 'GMAIL_APP_PASSWORD') return 'pass';
        if (key === 'APP_URL') return 'http://localhost:3000';
        if (key === 'SMTP_HOST') return 'smtp.gmail.com';
        if (key === 'SMTP_PORT') return '465';
        if (key === 'SMTP_SECURE') return 'true';
        if (key === 'FROM_EMAIL') return 'user';
        if (key === 'FROM_NAME') return 'BookNest';
        return null;
      });
      mailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.resendVerification('user@example.com');

      expect(result.message).toContain('If that email exists');
      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        { emailVerificationToken: expect.any(String) },
      );
      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('returns message when sendVerificationEmail throws', async () => {
      const user = { id: 'user-1', email: 'user@example.com' } as any;
      usersService.findByEmail.mockResolvedValue(user);
      usersRepository.update.mockResolvedValue({} as any);
      configService.get.mockImplementation((key: string) => {
        if (key === 'GMAIL_USER') return 'user';
        if (key === 'GMAIL_APP_PASSWORD') return 'pass';
        if (key === 'APP_URL') return 'http://localhost:3000';
        if (key === 'SMTP_HOST') return 'smtp.gmail.com';
        if (key === 'SMTP_PORT') return '465';
        if (key === 'SMTP_SECURE') return 'true';
        if (key === 'FROM_EMAIL') return 'user';
        if (key === 'FROM_NAME') return 'BookNest';
        return null;
      });
      mailService.sendVerificationEmail.mockRejectedValue(
        new Error('SMTP error'),
      );

      const result = await service.resendVerification('user@example.com');

      expect(result.message).toContain('If that email exists');
    });
  });

  describe('resendVerificationCode', () => {
    it('throws NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resendVerificationCode('user@example.com'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when email already verified', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: true,
      } as any;
      usersRepository.findOne.mockResolvedValue(user);

      await expect(
        service.resendVerificationCode('user@example.com'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates verification code and sends email when not verified', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: false,
      } as any;
      usersRepository.findOne.mockResolvedValue(user);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);

      const result = await service.resendVerificationCode('user@example.com');

      expect(verificationCodeService.createVerificationCode).toHaveBeenCalled();
      expect(verificationCodeService.sendVerificationEmail).toHaveBeenCalled();
      expect(result.message).toContain('Verification code sent successfully');
    });

    it('rethrows when sendVerificationEmail throws', async () => {
      const user: User = {
        id: 'user-1',
        email: 'user@example.com',
        emailVerified: false,
      } as any;
      usersRepository.findOne.mockResolvedValue(user);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);
      verificationCodeService.sendVerificationEmail.mockRejectedValue(
        new Error('SMTP failed'),
      );

      await expect(
        service.resendVerificationCode('user@example.com'),
      ).rejects.toThrow('SMTP failed');
    });
  });
});
