import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { SeriesService } from './series.service';
import { JwtAuthGuard, RolesGuard } from '../auth/guards';
import { Roles } from '../auth/decorators';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from '../users/enums';
import { CreateSeriesDto } from './dto/create-series.dto';
import { UpdateSeriesDto } from './dto/update-series.dto';
import { Series } from './entity/series.entity';

@ApiTags('Series')
@Controller('series')
export class SeriesController {
  constructor(private readonly seriesService: SeriesService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Post()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new series (Author only)' })
  @ApiResponse({
    status: 201,
    description: 'Series created successfully',
    type: Series,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateSeriesDto) {
    return this.seriesService.create(user.sub, user.userType as any, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Get('my')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current author's series" })
  @ApiResponse({ status: 200, description: 'List of series', type: [Series] })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Author access required',
  })
  my(@CurrentUser('sub') authorId: string) {
    return this.seriesService.listMine(authorId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update series (Author only)' })
  @ApiResponse({
    status: 200,
    description: 'Series updated successfully',
    type: Series,
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot edit others series',
  })
  @ApiResponse({ status: 404, description: 'Series not found' })
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSeriesDto,
  ) {
    return this.seriesService.update(user.sub, user.userType as any, id, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserType.AUTHOR)
  @Delete(':id')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete series (Author only)' })
  @ApiResponse({ status: 200, description: 'Series deleted successfully' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Cannot delete others series',
  })
  @ApiResponse({ status: 404, description: 'Series not found' })
  remove(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.seriesService.remove(user.sub, user.userType as any, id);
  }
}
