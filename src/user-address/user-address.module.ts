import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserAddress } from './entity/user-address.entity';
import { UserAddressService } from './user-address.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserAddress])],
  providers: [UserAddressService],
  controllers: [],
  exports: [UserAddressService],
})
export class UserAddressModule {}
