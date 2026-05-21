import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  ResetPasswordDto,
  VerifyEmailDto,
  RequestPasswordResetDto,
} from './dto';
import {
  AuthResponseDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  LogoutResponseDto,
  VerificationStatusResponseDto,
} from './dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ type: RegisterDto })
  @ApiResponse({
    status: 201,
    description: 'User registered successfully',
    type: AuthResponseDto,
  })
  @ApiResponse({ status: 409, description: 'User already exists' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(@Body() dto: RegisterDto): Promise<AuthResponseDto> {
    return this.authService.register(dto);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with email/username and password' })
  @ApiQuery({
    name: 'persist',
    required: false,
    description: 'Whether to persist session',
  })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout from current device' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { refreshToken: { type: 'string' } },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Logged out successfully',
    type: LogoutResponseDto,
  })
  logout(
    @Body('refreshToken') refreshToken: string,
  ): Promise<LogoutResponseDto> {
    return this.authService.logout(refreshToken);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Logout from all devices (revoke all refresh tokens)' })
  @ApiResponse({
    status: 200,
    description: 'Logged out from all devices',
    type: LogoutResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid access token' })
  logoutAll(@CurrentUser('sub') userId: string): Promise<LogoutResponseDto> {
    return this.authService.logoutAll(userId);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiResponse({
    status: 200,
    description: 'Token refreshed successfully',
    type: RefreshTokenResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async refresh(
    @Body() dto: RefreshTokenDto,
  ): Promise<RefreshTokenResponseDto> {
    return this.authService.refresh(dto);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email using verification code' })
  @ApiResponse({ status: 200, description: 'Email verified successfully' })
  @ApiResponse({
    status: 401,
    description: 'Invalid or expired verification code',
  })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailWithCode(dto);
  }

  @Post('request-password-reset')
  @ApiOperation({ summary: 'Request password reset via verification code' })
  @ApiResponse({
    status: 200,
    description: 'Password reset code sent (if email exists)',
  })
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using verification code' })
  @ApiResponse({ status: 200, description: 'Password reset successfully' })
  @ApiResponse({ status: 401, description: 'Invalid or expired reset code' })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordWithCode(dto);
  }

  @Post('resend-verification')
  @ApiOperation({ summary: 'Resend email verification code' })
  @ApiBody({
    schema: { type: 'object', properties: { email: { type: 'string' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Verification code sent successfully',
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 400, description: 'Email already verified' })
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerificationCode(body.email);
  }

  @Get('check-username')
  @ApiOperation({ summary: 'Check if username is available' })
  @ApiQuery({
    name: 'username',
    required: true,
    description: 'Username to check',
  })
  @ApiResponse({
    status: 200,
    description: 'Username availability status',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async checkUsername(@Query('username') username: string) {
    return this.authService.checkUsernameAvailability(username);
  }

  @Get('check-email')
  @ApiOperation({ summary: 'Check if email is available' })
  @ApiQuery({
    name: 'email',
    required: true,
    description: 'Email to check',
  })
  @ApiResponse({
    status: 200,
    description: 'Email availability status',
    schema: {
      type: 'object',
      properties: {
        available: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async checkEmail(@Query('email') email: string) {
    return this.authService.checkEmailAvailability(email);
  }

  @Get('verification-status/:userId')
  @ApiOperation({ summary: 'Get email verification status for a user' })
  @ApiResponse({
    status: 200,
    description: 'Verification status',
    type: VerificationStatusResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getVerificationStatus(
    @Param('userId') userId: string,
  ): Promise<VerificationStatusResponseDto> {
    return this.authService.getVerificationStatus(userId);
  }
}
