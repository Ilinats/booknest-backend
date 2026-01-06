import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Delete,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { UpdateProfileDto, UploadAvatarDto } from './dto';
import { UserResponseDto, UserPublicResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards';
import {
  CurrentUser,
  JwtPayload,
} from '../auth/decorators/current-user.decorator';
import { UserType } from './enums';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}
  @UseGuards(JwtAuthGuard)
  @Post('me/avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload avatar image for current user' })
  @ApiResponse({ status: 200, description: 'Avatar uploaded successfully' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadAvatarDto })
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({
    status: 200,
    description: 'Current user profile',
    type: UserResponseDto,
  })
  async me(@CurrentUser() payload: JwtPayload) {
    return this.usersService.findOneByIdResponse(payload.sub, true);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user statistics' })
  @ApiResponse({ status: 200, description: 'User statistics' })
  async getMyStats(@CurrentUser('sub') userId: string) {
    return this.usersService.getMyStats(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id/stats')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get author statistics (Author access required)' })
  @ApiResponse({ status: 200, description: 'Author statistics' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async getAuthorStats(
    @CurrentUser() user: JwtPayload,
    @Param('id', new ParseUUIDPipe()) authorId: string,
  ) {
    return this.usersService.getAuthorStats(authorId, user.sub, user.userType);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (public profile, no email)' })
  @ApiResponse({
    status: 200,
    description: 'User found',
    type: UserPublicResponseDto,
  })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.usersService.findOneByIdResponse(id, false);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  @ApiBearerAuth()
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: false,
    }),
  )
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    type: UserResponseDto,
  })
  async updateMe(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete current user account' })
  @ApiResponse({ status: 200, description: 'Account deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteAccount(@CurrentUser('sub') userId: string) {
    await this.usersService.remove(userId);
    return { message: 'Account deleted successfully' };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me/avatar')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove avatar image for current user' })
  @ApiResponse({ status: 200, description: 'Avatar removed successfully' })
  async removeAvatar(@CurrentUser('sub') userId: string) {
    return this.usersService.removeAvatar(userId);
  }
}
