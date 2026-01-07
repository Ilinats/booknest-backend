import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entity';
import { UsersService } from '../users/users.service';
import { MailModule } from '../mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefreshToken } from './entity/refresh-token.entity';
import { UserAddressModule } from '../user-address/user-address.module';
import { Book } from '../books/entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { VerificationCode } from './entity/verification-code.entity';
import { VerificationCodeService } from './services/verification-code.service';
import { FilesModule } from '../files/files.module';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    FilesModule,
    UserAddressModule,
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      Book,
      Application,
      Review,
      VerificationCode,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
        signOptions: {
          expiresIn: (config.get<string>('JWT_EXPIRES_IN') ?? '15m') as any,
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
