import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FilesService } from './files.service';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

jest.mock('@aws-sdk/client-s3', () => {
  return {
    S3Client: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue({}),
    })),
    PutObjectCommand: jest.fn(),
    GetObjectCommand: jest.fn(),
    DeleteObjectCommand: jest.fn(),
  };
});

const mockGetSignedUrl = jest.fn().mockResolvedValue('https://signed-url');
jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

describe('FilesService', () => {
  let service: FilesService;
  let configService: jest.Mocked<ConfigService>;
  let s3ClientInstance: jest.Mocked<S3Client>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'AWS_REGION') return 'us-east-1';
              if (key === 'AWS_ACCESS_KEY_ID') return 'ACCESS_KEY';
              if (key === 'AWS_SECRET_ACCESS_KEY') return 'SECRET_KEY';
              if (key === 'ALLOWED_FILE_TYPES') return 'pdf,epub';
              if (key === 'MAX_FILE_SIZE') return '50MB';
              if (key === 'ALLOWED_IMAGE_TYPES') return 'jpg,jpeg,png,gif,webp';
              if (key === 'MAX_IMAGE_SIZE') return '10MB';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    configService = module.get(ConfigService);
    s3ClientInstance = (service as any).s3Client;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('throws when AWS credentials are not configured', () => {
    const configWithoutCreds = {
      get: jest.fn((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        return null;
      }),
    } as any;
    expect(() => new FilesService(configWithoutCreds)).toThrow(
      'AWS credentials not configured',
    );
  });

  it('throws when uploadFile is called without file', async () => {
    await expect(service.uploadFile(undefined as any)).rejects.toThrow();
  });

  it('throws when file has no buffer', async () => {
    const file: any = {
      originalname: 'book.pdf',
      size: 1024,
      buffer: undefined,
      mimetype: 'application/pdf',
    };
    await expect(service.uploadFile(file)).rejects.toThrow();
  });

  it('throws when file has no originalname', async () => {
    const file: any = {
      originalname: '',
      size: 1024,
      buffer: Buffer.from('test'),
      mimetype: 'application/pdf',
    };
    await expect(service.uploadFile(file)).rejects.toThrow();
  });

  it('rejects files with disallowed extension', async () => {
    const file: any = {
      originalname: 'malicious.exe',
      size: 1024,
      buffer: Buffer.from('test'),
      mimetype: 'application/octet-stream',
    };

    await expect(service.uploadFile(file)).rejects.toThrow(
      /File type not allowed/i,
    );
  });

  it('rejects file when too large', async () => {
    const file: any = {
      originalname: 'book.pdf',
      size: 100 * 1024 * 1024,
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
    };
    await expect(service.uploadFile(file)).rejects.toThrow(/File too large/i);
  });

  it('uploadFile returns url and key on success', async () => {
    const file: any = {
      originalname: 'book.pdf',
      size: 1024,
      buffer: Buffer.from('content'),
      mimetype: 'application/pdf',
    };
    const result = await service.uploadFile(file, 'books');
    expect(result).toMatchObject({
      fileKey: expect.stringContaining('books/'),
      fileSize: 1024,
      fileType: 'application/pdf',
    });
    expect(result.fileUrl).toContain(result.fileKey);
  });

  it('uploadFile throws when S3 send fails', async () => {
    s3ClientInstance.send = jest.fn().mockRejectedValue(new Error('S3 error'));
    const file: any = {
      originalname: 'book.pdf',
      size: 1024,
      buffer: Buffer.from('x'),
      mimetype: 'application/pdf',
    };
    await expect(service.uploadFile(file)).rejects.toThrow(
      /Failed to upload file to S3/,
    );
  });

  it('extracts file key from full URL', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'AWS_REGION') return 'us-east-1';
      if (key === 'AWS_ACCESS_KEY_ID') return 'ACCESS_KEY';
      if (key === 'AWS_SECRET_ACCESS_KEY') return 'SECRET_KEY';
      if (key === 'AWS_S3_BUCKET_NAME') return 'bucket';
      if (key === 'AWS_S3_BASE_URL')
        return 'https://bucket.s3.us-east-1.amazonaws.com';
      return null;
    });

    const localService = new FilesService(configService);
    const url = 'https://bucket.s3.us-east-1.amazonaws.com/books/file-key.pdf';

    const key = localService.extractFileKeyFromUrl(url);
    expect(key).toBe('books/file-key.pdf');
  });

  it('extracts file key from relative path', () => {
    const key = service.extractFileKeyFromUrl('books/file-key.pdf');
    expect(key).toBe('books/file-key.pdf');
  });

  it('extractFileKeyFromUrl returns null for empty url', () => {
    expect(service.extractFileKeyFromUrl('')).toBeNull();
  });

  it('extractFileKeyFromUrl uses pathname for valid URL', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'AWS_REGION') return 'us-east-1';
      if (key === 'AWS_ACCESS_KEY_ID') return 'ACCESS_KEY';
      if (key === 'AWS_SECRET_ACCESS_KEY') return 'SECRET_KEY';
      if (key === 'AWS_S3_BUCKET_NAME') return 'bucket';
      if (key === 'AWS_S3_BASE_URL')
        return 'https://bucket.s3.us-east-1.amazonaws.com';
      return null;
    });
    const localService = new FilesService(configService);
    expect(
      localService.extractFileKeyFromUrl(
        'https://bucket.s3.us-east-1.amazonaws.com/a/b/c.pdf',
      ),
    ).toBe('a/b/c.pdf');
  });

  it('getFileDownloadUrl returns signed URL', async () => {
    const url = await service.getFileDownloadUrl('books/key.pdf', 1800);
    expect(url).toBe('https://signed-url');
  });

  it('getFileDownloadUrl throws NotFoundException when getSignedUrl fails', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    mockGetSignedUrl.mockRejectedValueOnce(new Error('access denied'));
    await expect(service.getFileDownloadUrl('bad/key')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteFile throws when S3 delete fails', async () => {
    s3ClientInstance.send = jest
      .fn()
      .mockRejectedValue(new Error('delete failed'));
    await expect(service.deleteFile('some/key')).rejects.toThrow();
  });

  it('deleteFileByUrl returns early when fileUrl is empty', async () => {
    const deleteSpy = jest.spyOn(service, 'deleteFile');
    await service.deleteFileByUrl('');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('deleteFileByUrl logs warning when deleteFile throws', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(service, 'extractFileKeyFromUrl').mockReturnValueOnce('key.pdf');
    jest
      .spyOn(service, 'deleteFile')
      .mockRejectedValueOnce(new Error('S3 error'));
    await service.deleteFileByUrl('https://bucket.s3.amazonaws.com/key.pdf');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to delete file'),
      expect.any(Error),
    );
    consoleWarnSpy.mockRestore();
  });

  it('getFileMetadata returns metadata on success', async () => {
    s3ClientInstance.send = jest.fn().mockResolvedValue({
      ContentType: 'application/pdf',
      ContentLength: 1234,
      LastModified: new Date(),
      Metadata: { originalName: 'book.pdf' },
    });
    const meta = await service.getFileMetadata('books/key.pdf');
    expect(meta).toMatchObject({
      contentType: 'application/pdf',
      contentLength: 1234,
      metadata: { originalName: 'book.pdf' },
    });
  });

  it('getFileMetadata throws NotFoundException when S3 fails', async () => {
    const { NotFoundException } = await import('@nestjs/common');
    s3ClientInstance.send = jest.fn().mockRejectedValue(new Error('not found'));
    await expect(service.getFileMetadata('missing/key')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('deleteFileByUrl logs warning when key cannot be extracted', async () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    jest
      .spyOn(service, 'extractFileKeyFromUrl')
      .mockReturnValueOnce(null as any);

    await service.deleteFileByUrl('some-url-that-fails');

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });

  it('deleteFile calls S3 client send', async () => {
    await service.deleteFile('some/key.pdf');

    expect(s3ClientInstance.send).toHaveBeenCalled();
  });

  describe('uploadImage', () => {
    it('throws when no file', async () => {
      await expect(service.uploadImage(undefined as any)).rejects.toThrow();
    });

    it('throws when file has no buffer', async () => {
      const file: any = {
        originalname: 'cover.jpg',
        size: 1024,
        buffer: undefined,
        mimetype: 'image/jpeg',
      };
      await expect(service.uploadImage(file)).rejects.toThrow();
    });

    it('throws when file has no originalname', async () => {
      const file: any = {
        originalname: '',
        size: 1024,
        buffer: Buffer.from('x'),
        mimetype: 'image/jpeg',
      };
      await expect(service.uploadImage(file)).rejects.toThrow();
    });

    it('rejects disallowed image type', async () => {
      const file: any = {
        originalname: 'file.bmp',
        size: 1024,
        buffer: Buffer.from('x'),
        mimetype: 'image/bmp',
      };
      await expect(service.uploadImage(file)).rejects.toThrow(
        /Image type not allowed/i,
      );
    });

    it('rejects image when too large', async () => {
      const file: any = {
        originalname: 'cover.jpg',
        size: 20 * 1024 * 1024,
        buffer: Buffer.from('x'),
        mimetype: 'image/jpeg',
      };
      await expect(service.uploadImage(file)).rejects.toThrow(
        /Image too large/i,
      );
    });

    it('returns url and key on success', async () => {
      const file: any = {
        originalname: 'cover.png',
        size: 1024,
        buffer: Buffer.from('image'),
        mimetype: 'image/png',
      };
      const result = await service.uploadImage(file, 'covers');
      expect(result).toMatchObject({
        fileKey: expect.stringContaining('covers/'),
        fileSize: 1024,
        fileType: 'image/png',
      });
      expect(result.fileUrl).toContain(result.fileKey);
    });

    it('throws when S3 send fails', async () => {
      s3ClientInstance.send = jest
        .fn()
        .mockRejectedValue(new Error('S3 image error'));
      const file: any = {
        originalname: 'cover.jpg',
        size: 1024,
        buffer: Buffer.from('x'),
        mimetype: 'image/jpeg',
      };
      await expect(service.uploadImage(file)).rejects.toThrow(
        /Failed to upload image to S3/,
      );
    });
  });

  describe('extractFileKeyFromUrl fallbacks', () => {
    it('returns key from string that is not http(s) (relative path)', () => {
      expect(service.extractFileKeyFromUrl('folder/key.pdf')).toBe(
        'folder/key.pdf',
      );
    });

    it('when URL parse throws, uses path parts if no baseUrl match', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_ACCESS_KEY_ID') return 'ACCESS_KEY';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 'SECRET_KEY';
        if (key === 'AWS_S3_BUCKET_NAME') return 'bucket';
        if (key === 'AWS_S3_BASE_URL')
          return 'https://other-bucket.s3.amazonaws.com';
        return null;
      });
      const localService = new FilesService(configService);
      const invalidUrl = 'http://[/books/x.pdf';
      const key = localService.extractFileKeyFromUrl(invalidUrl);
      expect(key).toBeTruthy();
      expect(key).toContain('/');
    });

    it('when URL parse throws, uses baseUrl substring when baseUrl is in string', () => {
      const baseUrl = 'http://[';
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        if (key === 'AWS_REGION') return 'us-east-1';
        if (key === 'AWS_ACCESS_KEY_ID') return 'ACCESS_KEY';
        if (key === 'AWS_SECRET_ACCESS_KEY') return 'SECRET_KEY';
        if (key === 'AWS_S3_BUCKET_NAME') return 'bucket';
        if (key === 'AWS_S3_BASE_URL') return baseUrl;
        return null;
      });
      const localService = new FilesService(configService);
      const invalidUrlWithBaseUrl = 'http://[/books/x.pdf';
      const key = localService.extractFileKeyFromUrl(invalidUrlWithBaseUrl);
      expect(key).toBe('books/x.pdf');
    });
  });
});
