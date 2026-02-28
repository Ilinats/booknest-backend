import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entity';
import { UsersService } from '../users/users.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefreshToken } from './entity/refresh-token.entity';
import { UserAddressModule } from '../user-address/user-address.module';
import { VerificationCode } from './entity/verification-code.entity';
import { VerificationCodeService } from './services/verification-code.service';

@Module({
  imports: [
    ConfigModule,
    UserAddressModule,
    TypeOrmModule.forFeature([User, RefreshToken, VerificationCode]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '15m',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, VerificationCodeService],
  exports: [JwtModule],
})
export class AuthModule {}
