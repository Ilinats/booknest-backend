import { 
  Controller, 
  Post, 
  Get, 
  Delete, 
  Param, 
  UseInterceptors, 
  UploadedFile, 
  BadRequestException,
  UseGuards,
  Request,
  Res
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { User } from '../users/entity/user.entity';

@Controller('files')
@UseGuards(JwtAuthGuard)
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    const result = await this.filesService.uploadFile(file, 'books');
    
    return {
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileUrl: result.fileUrl,
        fileKey: result.fileKey,
        fileSize: result.fileSize,
        fileType: result.fileType,
        originalName: file.originalname,
      },
    };
  }

  @Get('download/:fileKey')
  async getDownloadUrl(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
  ) {
    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);
    
    return {
      success: true,
      message: 'Download URL generated successfully',
      data: {
        downloadUrl,
        expiresIn: 3600, // 1 hour
      },
    };
  }

  @Delete(':fileKey')
  async deleteFile(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
  ) {
    await this.filesService.deleteFile(fileKey);
    
    return {
      success: true,
      message: 'File deleted successfully',
    };
  }

  @Get('metadata/:fileKey')
  async getFileMetadata(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
  ) {
    const metadata = await this.filesService.getFileMetadata(fileKey);
    
    return {
      success: true,
      message: 'File metadata retrieved successfully',
      data: metadata,
    };
  }

  @Get('download/:fileKey')
  async downloadFile(
    @Param('fileKey') fileKey: string,
    @CurrentUser() user: User,
    @Res() res: any,
  ) {
    const downloadUrl = await this.filesService.getFileDownloadUrl(fileKey);
    res.redirect(downloadUrl);
  }
}
