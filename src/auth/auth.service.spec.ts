import { Test, TestingModule } from '@nestjs/testing';

jest.mock('argon2', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
  verify: jest.fn().mockResolvedValue(true),
  argon2id: 2,
}));

jest.mock('ms', () => {
  const impl = (val: string): number => {
    if (val === '7d') return 7 * 24 * 60 * 60 * 1000;
    return 86400000;
  };
  return impl;
});
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserAddressService } from '../user-address/user-address.service';
import { VerificationCodeService } from './services/verification-code.service';
import { User } from '../users/entity/user.entity';
import { RefreshToken } from './entity/refresh-token.entity';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyEmailDto,
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
} from './dto';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserType } from '../users/enums';
import { AuthErrors } from './errors/auth-errors';

type MockRepo<T = unknown> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

describe('AuthService', () => {
  let service: AuthService;
  let usersRepository: MockRepo<User>;
  let refreshTokenRepository: MockRepo<RefreshToken>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let userAddressService: jest.Mocked<UserAddressService>;
  let verificationCodeService: jest.Mocked<VerificationCodeService>;

  beforeEach(async () => {
    const mockConfigGet = jest.fn();
    mockConfigGet.mockImplementation((key: string) => {
      if (key === 'JWT_REFRESH_EXPIRES_IN') return '7d';
      if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret';
      if (key === 'JWT_SECRET') return 'jwt-secret';
      return undefined;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('jwt-token'),
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: mockConfigGet },
        },
        {
          provide: UserAddressService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: VerificationCodeService,
          useValue: {
            createVerificationCode: jest.fn(),
            verifyCode: jest.fn(),
            sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
            sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
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
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    userAddressService = module.get(UserAddressService);
    verificationCodeService = module.get(VerificationCodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestPasswordReset', () => {
    const dto: RequestPasswordResetDto = { email: 'user@example.com' };

    it('returns generic message when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.requestPasswordReset(dto);

      expect(result.message).toContain('If an account with that email exists');
      expect(verificationCodeService.createVerificationCode).not.toHaveBeenCalled();
      expect(verificationCodeService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('creates verification code and sends reset email when user exists', async () => {
      const user: User = { id: 'u1', email: dto.email } as any;
      usersRepository.findOne.mockResolvedValue(user);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);

      const result = await service.requestPasswordReset(dto);

      expect(verificationCodeService.createVerificationCode).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
      );
      expect(verificationCodeService.sendPasswordResetEmail).toHaveBeenCalled();
      expect(result.message).toContain('If an account with that email exists');
    });
  });

  describe('resetPasswordWithCode', () => {
    const dto: ResetPasswordDto = { code: 'ABC123', newPassword: 'Password1!' };

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
      const user: User = { id: 'u1', email: 'u@example.com' } as any;
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: true,
        user,
      } as any);

      const result = await service.resetPasswordWithCode(dto);

      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        expect.objectContaining({ passwordHash: expect.any(String) }),
      );
      expect(result.message).toBe('Password reset successfully');
    });
  });

  describe('verifyEmailWithCode', () => {
    const dto: VerifyEmailDto = { code: 'ABC123' };

    it('throws UnauthorizedException when code invalid', async () => {
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: false,
        user: null,
      } as any);

      await expect(
        service.verifyEmailWithCode(dto),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('marks email verified and returns user when code valid', async () => {
      const user: User = {
        id: 'u1',
        email: 'user@example.com',
        username: 'user1',
      } as any;
      verificationCodeService.verifyCode.mockResolvedValue({
        isValid: true,
        user,
      } as any);

      const result = await service.verifyEmailWithCode(dto);

      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        { emailVerified: true },
      );
      expect(result.user.id).toBe(user.id);
    });
  });

  describe('logout', () => {
    it('deletes refresh token by hash and returns message', async () => {
      refreshTokenRepository.delete.mockResolvedValue({} as any);

      const result = await service.logout('token');

      expect(refreshTokenRepository.delete).toHaveBeenCalled();
      expect(result.message).toBe('Logged out');
    });
  });

  describe('register', () => {
    const dto: RegisterDto = {
      email: 'user@example.com',
      username: 'user1',
      password: 'Password1!',
      firstName: 'First',
      lastName: 'Last',
      userType: UserType.READER,
    };

    it('throws ConflictException when user already exists (email or username)', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'existing' } as User);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
      await expect(service.register(dto)).rejects.toThrow(
        AuthErrors.USER_ALREADY_EXISTS,
      );
      expect(usersRepository.create).not.toHaveBeenCalled();
    });

    it('creates user and returns tokens when no address', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      const savedUser = {
        id: 'u1',
        email: dto.email,
        username: dto.username,
        userType: dto.userType,
      } as User;
      usersRepository.create.mockReturnValue(savedUser);
      usersRepository.save.mockResolvedValue(savedUser);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '123456',
      } as any);
      jwtService.signAsync.mockResolvedValue('jwt-token');
      refreshTokenRepository.save.mockResolvedValue({});

      const result = await service.register(dto);

      expect(usersRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: dto.email.toLowerCase(),
          username: dto.username,
          firstName: dto.firstName,
          lastName: dto.lastName,
          userType: dto.userType,
        }),
      );
      expect(verificationCodeService.sendVerificationEmail).toHaveBeenCalled();
      expect(userAddressService.create).not.toHaveBeenCalled();
      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
    });

    it('creates address when dto.address is provided', async () => {
      const withAddress = {
        ...dto,
        address: {
          streetAddress: 'Main St',
          city: 'City',
          postalCode: '12345',
          country: 'UK',
        },
      } as RegisterDto;
      usersRepository.findOne.mockResolvedValue(null);
      const savedUser = { id: 'u1', email: dto.email, username: dto.username } as User;
      usersRepository.create.mockReturnValue(savedUser);
      usersRepository.save.mockResolvedValue(savedUser);
      verificationCodeService.createVerificationCode.mockResolvedValue({ code: '123' } as any);
      jwtService.signAsync.mockResolvedValue('token');
      refreshTokenRepository.save.mockResolvedValue({});

      await service.register(withAddress);

      expect(userAddressService.create).toHaveBeenCalledWith(
        savedUser.id,
        withAddress.address,
      );
    });

    it('throws when usersRepository.save fails', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      usersRepository.create.mockReturnValue({ id: 'u1' } as User);
      const saveError = new Error('DB constraint failed');
      usersRepository.save.mockRejectedValue(saveError);

      await expect(service.register(dto)).rejects.toThrow('DB constraint failed');
    });

    it('returns tokens when sendVerificationEmail fails (verification is best-effort)', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      const savedUser = { id: 'u1', email: dto.email, username: dto.username } as User;
      usersRepository.create.mockReturnValue(savedUser);
      usersRepository.save.mockResolvedValue(savedUser);
      verificationCodeService.createVerificationCode.mockResolvedValue({ code: '123' } as any);
      verificationCodeService.sendVerificationEmail.mockRejectedValue(new Error('SMTP down'));
      jwtService.signAsync.mockResolvedValue('token');
      refreshTokenRepository.save.mockResolvedValue({});

      const result = await service.register(dto);

      expect(result.accessToken).toBe('token');
      expect(result.refreshToken).toBe('token');
    });
  });

  describe('login', () => {
    const dto: LoginDto = { identifier: 'user@example.com', password: 'pass' };

    it('throws UnauthorizedException when credentials are invalid', async () => {
      usersRepository.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.login(dto)).rejects.toThrow(
        AuthErrors.INVALID_CREDENTIALS,
      );
    });

    it('returns tokens and updates last login when credentials valid', async () => {
      const user = {
        id: 'u1',
        email: 'user@example.com',
        username: 'user1',
        userType: UserType.READER,
        passwordHash: 'hash',
      } as User;
      usersRepository.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(user),
      });
      jwtService.signAsync.mockResolvedValue('jwt-token');
      refreshTokenRepository.save.mockResolvedValue({});

      const result = await service.login(dto);

      expect(usersRepository.update).toHaveBeenCalledWith(
        { id: user.id },
        expect.objectContaining({ lastLogin: expect.any(Date) }),
      );
      expect(result.accessToken).toBe('jwt-token');
      expect(result.refreshToken).toBe('jwt-token');
    });
  });

  describe('refresh', () => {
    const dto: RefreshTokenDto = { refreshToken: 'valid-refresh-token' };

    it('throws UnauthorizedException when JWT verify fails', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid'));

      await expect(service.refresh(dto)).rejects.toThrow(UnauthorizedException);
      await expect(service.refresh(dto)).rejects.toThrow(
        AuthErrors.INVALID_REFRESH_TOKEN,
      );
    });

    it('throws UnauthorizedException when token not in DB or expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'u1',
        email: 'u@ex.com',
        userType: UserType.READER,
      });
      refreshTokenRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toThrow(
        AuthErrors.INVALID_REFRESH_TOKEN,
      );
    });

    it('throws UnauthorizedException when stored token is expired', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'u1',
        email: 'u@ex.com',
        userType: UserType.READER,
      });
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'rt1',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(service.refresh(dto)).rejects.toThrow(
        AuthErrors.INVALID_REFRESH_TOKEN,
      );
    });

    it('throws NotFoundException when user not found', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'missing-user',
        email: 'u@ex.com',
        userType: UserType.READER,
      });
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'rt1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      usersRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh(dto)).rejects.toThrow(NotFoundException);
      await expect(service.refresh(dto)).rejects.toThrow(AuthErrors.USER_NOT_FOUND);
    });

    it('deletes old token and returns new tokens when valid', async () => {
      const user = {
        id: 'u1',
        email: 'u@ex.com',
        username: 'user1',
        userType: UserType.READER,
      } as User;
      jwtService.verifyAsync.mockResolvedValue({
        sub: user.id,
        email: user.email,
        userType: user.userType,
      });
      refreshTokenRepository.findOne.mockResolvedValue({
        id: 'rt1',
        expiresAt: new Date(Date.now() + 86400000),
      });
      refreshTokenRepository.delete.mockResolvedValue({});
      usersRepository.findOne.mockResolvedValue(user);
      jwtService.signAsync.mockResolvedValue('new-token');

      const result = await service.refresh(dto);

      expect(refreshTokenRepository.delete).toHaveBeenCalledWith({ id: 'rt1' });
      expect(result.accessToken).toBe('new-token');
      expect(result.refreshToken).toBe('new-token');
    });
  });

  describe('resendVerificationCode', () => {
    it('throws NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.resendVerificationCode('nobody@example.com'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.resendVerificationCode('nobody@example.com'),
      ).rejects.toThrow(AuthErrors.USER_NOT_FOUND);
    });

    it('throws BadRequestException when email already verified', async () => {
      usersRepository.findOne.mockResolvedValue({
        id: 'u1',
        email: 'u@ex.com',
        emailVerified: true,
      } as User);

      await expect(
        service.resendVerificationCode('u@ex.com'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.resendVerificationCode('u@ex.com'),
      ).rejects.toThrow(AuthErrors.EMAIL_ALREADY_VERIFIED);
    });

    it('sends verification email and returns message when success', async () => {
      const user = {
        id: 'u1',
        email: 'u@ex.com',
        emailVerified: false,
      } as User;
      usersRepository.findOne.mockResolvedValue(user);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '654321',
      } as any);

      const result = await service.resendVerificationCode('u@ex.com');

      expect(verificationCodeService.createVerificationCode).toHaveBeenCalledWith(
        user.id,
        expect.any(String),
      );
      expect(verificationCodeService.sendVerificationEmail).toHaveBeenCalledWith(
        user,
        '654321',
      );
      expect(result.message).toBe('Verification code sent successfully');
    });

    it('rethrows when sendVerificationEmail fails', async () => {
      const user = {
        id: 'u1',
        email: 'u@ex.com',
        emailVerified: false,
      } as User;
      usersRepository.findOne.mockResolvedValue(user);
      verificationCodeService.createVerificationCode.mockResolvedValue({
        code: '111',
      } as any);
      const sendError = new Error('SMTP failed');
      verificationCodeService.sendVerificationEmail.mockRejectedValue(sendError);

      await expect(
        service.resendVerificationCode('u@ex.com'),
      ).rejects.toThrow('SMTP failed');
    });
  });

  describe('getVerificationStatus', () => {
    it('throws NotFoundException when user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      await expect(
        service.getVerificationStatus('missing-id'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.getVerificationStatus('missing-id'),
      ).rejects.toThrow(AuthErrors.USER_NOT_FOUND);
    });

    it('returns status when user exists', async () => {
      const user = {
        id: 'u1',
        email: 'u@ex.com',
        emailVerified: true,
        isActive: true,
      } as User;
      usersRepository.findOne.mockResolvedValue(user);

      const result = await service.getVerificationStatus('u1');

      expect(result).toEqual({
        userId: 'u1',
        email: 'u@ex.com',
        emailVerified: true,
        isActive: true,
      });
    });
  });

  describe('checkUsernameAvailability', () => {
    it('returns available when username not taken', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.checkUsernameAvailability('newuser');

      expect(result.available).toBe(true);
      expect(result.message).toBe('Username is available');
    });

    it('returns not available when username taken', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'u1' } as User);

      const result = await service.checkUsernameAvailability('taken');

      expect(result.available).toBe(false);
      expect(result.message).toBe('Username is already taken');
    });
  });

  describe('checkEmailAvailability', () => {
    it('returns available when email not registered', async () => {
      usersRepository.findOne.mockResolvedValue(null);

      const result = await service.checkEmailAvailability('new@example.com');

      expect(result.available).toBe(true);
      expect(result.message).toBe('Email is available');
    });

    it('returns not available when email registered', async () => {
      usersRepository.findOne.mockResolvedValue({ id: 'u1' } as User);

      const result = await service.checkEmailAvailability('used@example.com');

      expect(result.available).toBe(false);
      expect(result.message).toBe('Email is already registered');
      expect(usersRepository.findOne).toHaveBeenCalledWith({
        where: { email: 'used@example.com' },
      });
    });
  });
});

