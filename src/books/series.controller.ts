import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { SeriesService } from './series.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';

@UseGuards(JwtAuthGuard)
@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @Get('my')
  my(@CurrentUser('sub') authorId: string) {
    return this.seriesService.listMine(authorId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSeriesDto) {
    return this.seriesService.create(user.sub, user.userType as any, dto);
  }

  @Patch(':id')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateSeriesDto) {
    return this.seriesService.update(user.sub, user.userType as any, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.seriesService.remove(user.sub, user.userType as any, id);
  }
}


