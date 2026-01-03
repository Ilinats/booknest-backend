import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { User } from '../users/entity/user.entity';
import { UserGenrePreferencesService } from './user-genre-preferences.service';
import { UpsertPreferenceDto } from './dto/upsert-preference.dto';

@ApiTags('User Genre Preferences')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@Controller('me/genre-preferences')
export class UserGenrePreferencesController {
  constructor(private readonly prefsService: UserGenrePreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get user genre preferences (Authenticated)' })
  @ApiResponse({ status: 200, description: 'List of genre preferences' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  list(@CurrentUser('sub') userId: string) {
    return this.prefsService.listForUser(userId);
  }

  @Post()
  @ApiOperation({ summary: 'Add or update genre preference (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Genre preference updated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  upsert(@CurrentUser() payload: JwtPayload, @Body() dto: UpsertPreferenceDto) {
    const user = { id: payload.sub } as User;
    return this.prefsService.upsert(user, dto.genreId);
  }

  @Delete()
  @ApiOperation({ summary: 'Remove genre preference (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Genre preference removed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  remove(
    @CurrentUser('sub') userId: string,
    @Body('genreId', ParseIntPipe) genreId: number,
  ) {
    return this.prefsService.remove(userId, genreId);
  }
}
