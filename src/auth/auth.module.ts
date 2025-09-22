import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { User } from '../users/entity/user.entity';
import { UsersService } from '../users/users.service';
import { MailModule } from '../mail/mail.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RefreshToken } from './entity/refresh-token.entity';
import { UserAddress } from '../users/entity/user-address.entity';
import { UserAddressService } from '../users/user-address.service';

@Module({
  imports: [
    ConfigModule,
    MailModule,
    TypeOrmModule.forFeature([User, RefreshToken, UserAddress]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev_secret_change_me',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') ?? '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, UsersService, UserAddressService],
  exports: [JwtModule],
})
export class AuthModule {} 