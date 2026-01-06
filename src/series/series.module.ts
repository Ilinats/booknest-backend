import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Series } from './entity/series.entity';
import { SeriesService } from './series.service';
import { SeriesController } from './series.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Series]), AuthModule],
  providers: [SeriesService],
  controllers: [SeriesController],
  exports: [SeriesService],
})
export class SeriesModule {}
