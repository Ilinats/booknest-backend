import { Body, Controller, Get, Header, Param, Post, Query, Res, UsePipes, ValidationPipe } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { Response, Request } from 'express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response, @Query('deviceName') deviceName?: string, @Query('persist') persist?: string) {
    const meta = { ip: res.req.ip, userAgent: res.req.headers['user-agent'], deviceName };
    return this.authService.login(dto, meta);
  }

  @Post('logout')
  logout(@Body('refreshToken') refreshToken: string) {
    return this.authService.logout(refreshToken);
  }

  @Post('logout-all')
  async logoutAll(@Body('userId') userId: string) {
    return this.authService.logoutAll(userId);
  }

  @Post('refresh-token')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async refresh(@Body() dto: RefreshTokenDto, @Res({ passthrough: true }) res: Response) {
    const meta = { ip: res.req.ip, userAgent: res.req.headers['user-agent'] };
    return this.authService.refresh(dto, meta);
  }

  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }


  @Post('verify-email/mobile')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async verifyEmailMobile(@Body() body: { token: string }) {
    try {
      const result = await this.authService.verifyEmail(body.token);
      return {
        success: true,
        message: 'Email verified successfully',
        user: result.user
      };
    } catch (error) {
      return {
        success: false,
        message: 'Email verification failed',
        error: error.message
      };
    }
  }

  @Get('verification-status/:userId')
  async getVerificationStatus(@Param('userId') userId: string) {
    return this.authService.getVerificationStatus(userId);
  }

  @Post('google')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async googleAuth(@Body() body: { idToken: string; userType?: 'reader' | 'author' }) {
    try {
      const { OAuth2Client } = require('google-auth-library');
      const clientId = process.env.GOOGLE_CLIENT_ID;
      
      if (!clientId) {
        throw new Error('Google Client ID not configured');
      }
      
      const client = new OAuth2Client(clientId);
      
      const ticket = await client.verifyIdToken({
        idToken: body.idToken,
        audience: clientId,
      });
      
      const payload = ticket.getPayload();
      
      if (!payload) {
        throw new Error('Invalid token payload');
      }
      
      const googleUser = {
        googleId: payload.sub,
        email: payload.email,
        firstName: payload.given_name || '',
        lastName: payload.family_name || '',
        avatarUrl: payload.picture || null,
      };

      return await this.authService.googleAuth(googleUser, body.userType);
    } catch (error) {
      console.error('Google mobile auth error:', error);
      throw new Error(`Google authentication failed: ${error.message}`);
    }
  }

  // New verification code endpoints
  @Post('verify-email')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmailWithCode(dto);
  }

  @Post('request-password-reset')
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPasswordWithCode(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 300000 } })
  async resendVerification(@Body() body: { email: string }) {
    return this.authService.resendVerificationCode(body.email);
  }
} 