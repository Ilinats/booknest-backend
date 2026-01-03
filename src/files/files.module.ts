import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, forwardRef(() => AuthModule)],
  providers: [FilesService],
  controllers: [FilesController],
  exports: [FilesService],
})
export class FilesModule {}
