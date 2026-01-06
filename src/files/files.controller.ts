import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entity/user.entity';

@ApiTags('Files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file (Authenticated)' })
  @ApiResponse({ status: 200, description: 'File uploaded successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    const result = await this.filesService.uploadFile(file, 'books');

    return {
      fileUrl: result.fileUrl,
      fileKey: result.fileKey,
      fileSize: result.fileSize,
      fileType: result.fileType,
      originalName: file.originalname,
    };
  }

  @Get('download/:fileKey')
  @ApiOperation({ summary: 'Get download URL for a file (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'Download URL generated successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getDownloadUrl(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
  ) {
    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);

    return {
      downloadUrl,
      expiresIn: 3600,
    };
  }

  @Get('metadata/:fileKey')
  @ApiOperation({ summary: 'Get file metadata (Authenticated)' })
  @ApiResponse({
    status: 200,
    description: 'File metadata retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getFileMetadata(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
  ) {
    const metadata = await this.filesService.getFileMetadata(fileKey);

    return metadata;
  }

  @Get('download/:fileKey')
  @ApiOperation({ summary: 'Download a file directly (Authenticated)' })
  @ApiResponse({ status: 302, description: 'Redirects to file download URL' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async downloadFile(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
    @Res() res: any,
  ) {
    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);
    res.redirect(downloadUrl);
  }
}
