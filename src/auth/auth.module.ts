import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entity';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserAddressModule } from '../user-address/user-address.module';
import { VerificationCode } from './entity/verification-code.entity';
import { VerificationCodeService } from './services/verification-code.service';
import { RefreshTokenStoreService } from './services/refresh-token-store.service';
import { FilesModule } from '../files/files.module';
import { MailModule } from '../mail/mail.module';
import { jwtExpiresIn } from './jwt-expires-in.util';

@Module({
  imports: [
    ConfigModule,
    UserAddressModule,
    FilesModule,
    MailModule,
    TypeOrmModule.forFeature([User, VerificationCode]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret:
          config.get<string>('JWT_SECRET')?.trim() || 'dev_secret_change_me',
        signOptions: {
          expiresIn: jwtExpiresIn(config.get<string>('JWT_EXPIRES_IN'), '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, VerificationCodeService, RefreshTokenStoreService],
  exports: [JwtModule],
})
export class AuthModule {}
