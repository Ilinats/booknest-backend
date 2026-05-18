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
import { Book } from '../books/entity';
import { Application } from '../applications/entity/application.entity';
import { Review } from '../reviews/entity/review.entity';
import { FilesModule } from '../files/files.module';
import { MailModule } from '../mail/mail.module';
import { ApprovedBookApplicationGuard } from './guards/approved-book-application.guard';
import { jwtExpiresIn } from './jwt-expires-in.util';

@Module({
  imports: [
    ConfigModule,
    UserAddressModule,
    FilesModule,
    MailModule,
    TypeOrmModule.forFeature([
      User,
      RefreshToken,
      VerificationCode,
      Book,
      Application,
      Review,
    ]),
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
  providers: [
    AuthService,
    UsersService,
    VerificationCodeService,
    ApprovedBookApplicationGuard,
  ],
  exports: [JwtModule, ApprovedBookApplicationGuard],
})
export class AuthModule {}
