import { Body, Controller, Delete, Get, ParseIntPipe, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';
import { User } from '../users/entity/user.entity';
import { UserGenrePreferencesService } from './user-genre-preferences.service';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';

@UseGuards(JwtAuthGuard)
@Controller('me/genre-preferences')
export class UserGenrePreferencesController {
  constructor(private readonly prefsService: UserGenrePreferencesService) {}

  @Get()
  list(@CurrentUser('sub') userId: string) {
    return this.prefsService.listForUser(userId);
  }

  @Post()
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  upsert(@CurrentUser() payload: JwtPayload, @Body() dto: UpsertPreferenceDto) {
    const user = { id: payload.sub } as User;
    return this.prefsService.upsert(user, dto.genreId, dto.preferenceLevel);
  }

  @Delete()
  remove(@CurrentUser('sub') userId: string, @Body('genreId', ParseIntPipe) genreId: number) {
    return this.prefsService.remove(userId, genreId);
  }
}


