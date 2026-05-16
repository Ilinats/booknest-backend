import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { Readable } from 'stream';
import { FileErrorCode } from './errors';

@Injectable()
export class FilesService {
  private s3Client: S3Client;
  private bucketName: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );

    if (!accessKeyId || !secretAccessKey) {
      throw new Error('AWS credentials not configured');
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    this.bucketName =
      this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'booknest-files';
    this.baseUrl =
      this.configService.get<string>('AWS_S3_BASE_URL') ||
      `https://${this.bucketName}.s3.${region}.amazonaws.com`;
  }

  private validateFileType(filename: string): boolean {
    const allowedTypes = this.configService
      .get<string>('ALLOWED_FILE_TYPES')
      ?.split(',') || ['pdf', 'epub'];

    const fileExtension = filename.split('.').pop()?.toLowerCase();
    return allowedTypes.includes(fileExtension || '');
  }

  private validateImageType(filename: string): boolean {
    const allowedImageTypes = this.configService
      .get<string>('ALLOWED_IMAGE_TYPES')
      ?.split(',') || ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    const fileExtension = filename.split('.').pop()?.toLowerCase();
    return allowedImageTypes.includes(fileExtension || '');
  }

  private validateFileSize(fileSize: number): boolean {
    const maxSize = this.parseFileSize(
      this.configService.get<string>('MAX_FILE_SIZE') || '50MB',
    );
    return fileSize <= maxSize;
  }

  private parseFileSize(sizeStr: string): number {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 50 * 1024 * 1024; // Default 50MB
    return (
      parseFloat(match[1]) * units[match[2].toUpperCase() as keyof typeof units]
    );
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'books',
  ): Promise<{
    fileUrl: string;
    fileKey: string;
    fileSize: number;
    fileType: string;
  }> {
    if (!file) {
      throw new BadRequestException(FileErrorCode.FILE_REQUIRED);
    }

    if (!file.buffer) {
      throw new BadRequestException(FileErrorCode.FILE_BUFFER_MISSING);
    }

    if (!file.originalname) {
      throw new BadRequestException(FileErrorCode.FILE_ORIGINAL_NAME_MISSING);
    }

    if (!this.validateFileType(file.originalname)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.configService.get<string>('ALLOWED_FILE_TYPES') || 'pdf, epub, mobi, doc, docx, txt'}`,
      );
    }

    if (!this.validateFileSize(file.size)) {
      throw new BadRequestException(
        `File too large. Max size: ${this.configService.get<string>('MAX_FILE_SIZE') || '50MB'}`,
      );
    }

    const fileExtension =
      file.originalname.split('.').pop()?.toLowerCase() || 'unknown';
    const uniqueFilename = `${randomUUID()}.${fileExtension}`;
    const fileKey = `${folder}/${uniqueFilename}`;

    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype || 'application/octet-stream',
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(uploadCommand);

      return {
        fileUrl: `${this.baseUrl}/${fileKey}`,
        fileKey,
        fileSize: file.size,
        fileType: file.mimetype || 'application/octet-stream',
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to upload file to S3: ${errorMessage}`,
      );
    }
  }

  async getObjectBuffer(fileKey: string): Promise<Buffer> {
    try {
      const result = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.bucketName,
          Key: fileKey,
        }),
      );
      if (!result.Body) {
        throw new NotFoundException(FileErrorCode.FILE_NOT_FOUND);
      }
      return await this.readStreamToBuffer(result.Body as Readable);
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      console.error('S3 get object error:', error);
      throw new NotFoundException(FileErrorCode.FILE_ACCESS_DENIED);
    }
  }

  private async readStreamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async getFileDownloadUrl(
    fileKey: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ResponseContentDisposition: 'attachment',
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('S3 download URL error:', error);
      throw new NotFoundException(FileErrorCode.FILE_ACCESS_DENIED);
    }
  }

  extractFileKeyFromUrl(fileUrl: string): string | null {
    if (!fileUrl) return null;

    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
      return fileUrl;
    }

    try {
      const url = new URL(fileUrl);
      return url.pathname.substring(1);
    } catch {
      const baseUrlMatch = fileUrl.indexOf(this.baseUrl);
      if (baseUrlMatch !== -1) {
        return fileUrl.substring(this.baseUrl.length + 1);
      }
      const parts = fileUrl.split('/');
      if (parts.length >= 2) {
        return parts.slice(-2).join('/');
      }
      return null;
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new BadRequestException(FileErrorCode.FILE_DELETE_FAILED);
    }
  }

  async deleteFileByUrl(fileUrl: string): Promise<void> {
    if (!fileUrl) {
      return;
    }

    const fileKey = this.extractFileKeyFromUrl(fileUrl);
    if (!fileKey) {
      console.warn(`Could not extract file key from URL: ${fileUrl}`);
      return;
    }

    try {
      await this.deleteFile(fileKey);
    } catch (error) {
      console.warn(`Failed to delete file from S3: ${fileKey}`, error);
    }
  }

  async getFileMetadata(fileKey: string): Promise<any> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
      });

      const response = await this.s3Client.send(command);
      return {
        contentType: response.ContentType,
        contentLength: response.ContentLength,
        lastModified: response.LastModified,
        metadata: response.Metadata,
      };
    } catch (error) {
      console.error('S3 metadata error:', error);
      throw new NotFoundException(FileErrorCode.FILE_NOT_FOUND);
    }
  }

  async uploadImage(
    file: Express.Multer.File,
    folder: string = 'images',
  ): Promise<{
    fileUrl: string;
    fileKey: string;
    fileSize: number;
    fileType: string;
  }> {
    if (!file) {
      throw new BadRequestException(FileErrorCode.FILE_REQUIRED);
    }

    if (!file.buffer) {
      throw new BadRequestException(FileErrorCode.FILE_BUFFER_MISSING);
    }

    if (!file.originalname) {
      throw new BadRequestException(FileErrorCode.FILE_ORIGINAL_NAME_MISSING);
    }

    if (!this.validateImageType(file.originalname)) {
      throw new BadRequestException(
        `Image type not allowed. Allowed types: ${this.configService.get<string>('ALLOWED_IMAGE_TYPES') || 'jpg, jpeg, png, gif, webp'}`,
      );
    }

    const maxImageSize = this.parseFileSize(
      this.configService.get<string>('MAX_IMAGE_SIZE') || '10MB',
    );
    if (file.size > maxImageSize) {
      throw new BadRequestException(
        `Image too large. Max size: ${this.configService.get<string>('MAX_IMAGE_SIZE') || '10MB'}`,
      );
    }

    const fileExtension =
      file.originalname.split('.').pop()?.toLowerCase() || 'unknown';
    const uniqueFilename = `${randomUUID()}.${fileExtension}`;
    const fileKey = `${folder}/${uniqueFilename}`;

    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype || 'image/jpeg',
        Metadata: {
          originalName: file.originalname,
          uploadedAt: new Date().toISOString(),
        },
      });

      await this.s3Client.send(uploadCommand);

      return {
        fileUrl: `${this.baseUrl}/${fileKey}`,
        fileKey,
        fileSize: file.size,
        fileType: file.mimetype || 'image/jpeg',
      };
    } catch (error) {
      console.error('S3 image upload error:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(
        `Failed to upload image to S3: ${errorMessage}`,
      );
    }
  }
}
