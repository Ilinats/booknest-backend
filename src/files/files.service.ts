import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import {config} from "dotenv";
config();

@Injectable()
export class FilesService {
  private s3Client: S3Client;
  private bucketName: string;
  private baseUrl: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

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
    
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME') || 'booknest-files';
    this.baseUrl = this.configService.get<string>('AWS_S3_BASE_URL') || `https://${this.bucketName}.s3.${region}.amazonaws.com`;
  }

  private validateFileType(filename: string): boolean {
    const allowedTypes = this.configService.get<string>('ALLOWED_FILE_TYPES')?.split(',') || 
      ['pdf', 'epub', 'mobi', 'doc', 'docx', 'txt'];
    
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    return allowedTypes.includes(fileExtension || '');
  }

  private validateFileSize(fileSize: number): boolean {
    const maxSize = this.parseFileSize(this.configService.get<string>('MAX_FILE_SIZE') || '50MB');
    return fileSize <= maxSize;
  }

  private parseFileSize(sizeStr: string): number {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB)$/i);
    if (!match) return 50 * 1024 * 1024; // Default 50MB
    return parseFloat(match[1]) * units[match[2].toUpperCase() as keyof typeof units];
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'books'): Promise<{
    fileUrl: string;
    fileKey: string;
    fileSize: number;
    fileType: string;
  }> {
    if (!this.validateFileType(file.originalname)) {
      throw new BadRequestException(
        `File type not allowed. Allowed types: ${this.configService.get<string>('ALLOWED_FILE_TYPES')}`
      );
    }

    if (!this.validateFileSize(file.size)) {
      throw new BadRequestException(
        `File too large. Max size: ${this.configService.get<string>('MAX_FILE_SIZE')}`
      );
    }

    const fileExtension = file.originalname.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const fileKey = `${folder}/${uniqueFilename}`;

    try {
      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        Body: file.buffer,
        ContentType: file.mimetype,
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
        fileType: file.mimetype,
      };
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new BadRequestException('Failed to upload file to S3');
    }
  }

  async getFileDownloadUrl(fileKey: string, expiresIn: number = 3600): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileKey,
        ResponseContentDisposition: 'attachment',
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('S3 download URL error:', error);
      throw new NotFoundException('File not found or access denied');
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
      throw new BadRequestException('Failed to delete file from S3');
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
      throw new NotFoundException('File not found');
    }
  }
}
