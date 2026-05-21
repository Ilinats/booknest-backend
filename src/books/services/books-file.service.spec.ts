import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BooksFileService } from './books-file.service';
import { Book } from '../entity/book.entity';
import { FilesService } from '../../files/files.service';
import { UserType } from '../../users/enums';
import { BookPdfFingerprintService } from './book-pdf-fingerprint.service';
import { BookEpubFingerprintService } from './book-epub-fingerprint.service';

type MockRepo<T = any> = { [key: string]: jest.Mock };

function createMockRepo(): MockRepo {
  return {
    findOne: jest.fn(),
    save: jest.fn(),
  };
}

describe('BooksFileService', () => {
  let service: BooksFileService;
  let bookRepo: MockRepo<Book>;
  let filesService: jest.Mocked<FilesService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BooksFileService,
        {
          provide: getRepositoryToken(Book),
          useValue: createMockRepo(),
        },
        {
          provide: FilesService,
          useValue: {
            uploadFile: jest.fn(),
            uploadImage: jest.fn(),
            deleteFileByUrl: jest.fn(),
            extractFileKeyFromUrl: jest.fn(),
            getObjectBuffer: jest.fn(),
            getFileDownloadUrl: jest.fn(),
          },
        },
        {
          provide: BookPdfFingerprintService,
          useValue: {
            isPdfBook: jest.fn(),
            embedFingerprint: jest.fn(),
            extractFingerprint: jest.fn(),
          },
        },
        {
          provide: BookEpubFingerprintService,
          useValue: {
            isEpubBook: jest.fn(),
            embedFingerprint: jest.fn(),
            extractFingerprint: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<BooksFileService>(BooksFileService);
    bookRepo = module.get(getRepositoryToken(Book));
    filesService = module.get(FilesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('uploadBookFile', () => {
    it('should throw BadRequestException when file is missing', async () => {
      await expect(
        // @ts-expect-error runtime check
        service.uploadBookFile('a1', UserType.AUTHOR, 'b1', undefined),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('should upload file, delete old and update info', async () => {
      const book: Book = {
        id: 'b1',
        authorId: 'a1',
        fileUrl: 'old-file',
      } as any;

      bookRepo.findOne.mockResolvedValue(book);
      (filesService.uploadFile as jest.Mock).mockResolvedValue({
        fileUrl: 'new-url',
        fileSize: 100,
        fileType: 'application/pdf',
      });
      bookRepo.save.mockImplementation(async (b) => b);

      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'book.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 100,
        buffer: Buffer.from('data'),
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await service.uploadBookFile(
        'a1',
        UserType.AUTHOR,
        'b1',
        file,
      );

      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('old-file');
      expect(filesService.uploadFile).toHaveBeenCalled();
      expect(result.file.url).toBe('new-url');
    });
  });

  describe('removeCoverImage', () => {
    it('should delete cover image and save book', async () => {
      const book: Book = {
        id: 'b1',
        authorId: 'a1',
        coverImageUrl: 'old-cover',
      } as any;

      bookRepo.findOne.mockResolvedValue(book);
      bookRepo.save.mockImplementation(async (b) => b);

      const result = await service.removeCoverImage(
        'a1',
        UserType.AUTHOR,
        'b1',
      );

      expect(filesService.deleteFileByUrl).toHaveBeenCalledWith('old-cover');
      expect(result.coverImageUrl).toBeNull();
    });
  });
});
