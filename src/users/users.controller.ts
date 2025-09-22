import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../auth/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@CurrentUser() payload: JwtPayload) {
    return this.usersService.findOneById(payload.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@CurrentUser('sub') userId: string, @Body() dto: UpdateUserDto) {
    const allowed: UpdateUserDto = {
      firstName: dto.firstName,
      lastName: dto.lastName,
      avatarUrl: dto.avatarUrl,
      bio: dto.bio,
    };
    return this.usersService.update(userId, allowed);
  }

  @Get()
  findAll(@Query('search') search?: string, @Query('skip') skip?: string, @Query('take') take?: string) {
    const parsedSkip = skip ? parseInt(skip, 10) : undefined;
    const parsedTake = take ? parseInt(take, 10) : undefined;
    return this.usersService.findAll({ search, skip: parsedSkip, take: parsedTake });
  }

  @Get(':id')
  findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findOneById(id);
  }

  @Patch(':id')
  update(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.remove(id);
  }
} 