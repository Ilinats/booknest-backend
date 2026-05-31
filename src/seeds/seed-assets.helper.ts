import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { FilesService } from '../files/files.service';

export type SharedEpubAsset = {
  fileUrl: string;
  fileSize: number;
  fileType: string;
};

export class SeedAssetsHelper {
  private static readonly logger = new Logger(SeedAssetsHelper.name);

  static getSeedsRoot(): string {
    return __dirname;
  }

  static resolveAssetPath(...segments: string[]): string {
    return join(this.getSeedsRoot(), ...segments);
  }

  static readCoverBuffer(coverFile: string): Buffer {
    const coverPath = this.resolveAssetPath('bookcovers', coverFile);
    if (!existsSync(coverPath)) {
      throw new Error(`Cover image not found: ${coverPath}`);
    }
    return readFileSync(coverPath);
  }

  static readEpubBuffer(epubFilename: string): Buffer {
    const epubPath = this.resolveAssetPath('epub', epubFilename);
    if (!existsSync(epubPath)) {
      throw new Error(`EPUB file not found: ${epubPath}`);
    }
    return readFileSync(epubPath);
  }

  static mimeForCover(coverFile: string): string {
    const ext = coverFile.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'gif':
        return 'image/gif';
      default:
        return 'image/jpeg';
    }
  }

  static async uploadSharedEpub(
    filesService: FilesService,
    epubFilename: string,
  ): Promise<SharedEpubAsset> {
    const buffer = this.readEpubBuffer(epubFilename);
    const result = await filesService.uploadFile(
      {
        buffer,
        originalname: epubFilename,
        size: buffer.length,
        mimetype: 'application/epub+zip',
      } as Express.Multer.File,
      'books',
    );

    return {
      fileUrl: result.fileUrl,
      fileSize: result.fileSize,
      fileType: result.fileType,
    };
  }

  static async uploadCover(
    filesService: FilesService,
    coverFile: string,
  ): Promise<string> {
    const buffer = this.readCoverBuffer(coverFile);
    const result = await filesService.uploadImage(
      {
        buffer,
        originalname: coverFile,
        size: buffer.length,
        mimetype: this.mimeForCover(coverFile),
      } as Express.Multer.File,
      'book_covers',
    );

    return result.fileUrl;
  }

  static needsDigitalFile(distributionType: string): boolean {
    return distributionType === 'digital' || distributionType === 'both';
  }
}
