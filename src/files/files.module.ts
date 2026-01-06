import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesService } from './files.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, forwardRef(() => AuthModule)],
  providers: [FilesService],
  controllers: [],
  exports: [FilesService],
})
export class FilesModule {}
