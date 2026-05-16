import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PDFDocument } from 'pdf-lib';
import {
  BookPdfFingerprintService,
  BOOK_PDF_FINGERPRINT_FIELD,
} from './book-pdf-fingerprint.service';

describe('BookPdfFingerprintService', () => {
  let service: BookPdfFingerprintService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BookPdfFingerprintService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'BOOK_PDF_FINGERPRINT_SECRET' ? 'test-secret-key' : '',
          },
        },
      ],
    }).compile();
    service = moduleRef.get(BookPdfFingerprintService);
  });

  async function minimalPdfBytes(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    doc.addPage();
    const bytes = await doc.save();
    return Buffer.from(bytes);
  }

  it('round-trips fingerprint in a minimal PDF', async () => {
    const raw = await minimalPdfBytes();
    const marked = await service.embedFingerprint(raw, {
      bookId: '11111111-1111-1111-1111-111111111111',
      readerId: '22222222-2222-2222-2222-222222222222',
    });
    const extracted = await service.extractFingerprint(marked);
    expect(extracted).toMatchObject({
      bookId: '11111111-1111-1111-1111-111111111111',
      readerId: '22222222-2222-2222-2222-222222222222',
    });
    expect(extracted?.iat).toEqual(expect.any(Number));
  });

  it('verifyToken rejects tampered signature', () => {
    expect(service.verifyToken('not-a-valid-token')).toBeNull();
    expect(service.verifyToken('eyJib29rSWQiOiJ4In0.wrongsig')).toBeNull();
  });

  it('isPdfBook detects pdf by mime or extension', () => {
    expect(service.isPdfBook('application/pdf', 'books/x.epub')).toBe(true);
    expect(service.isPdfBook('application/epub+zip', 'books/x.pdf')).toBe(
      true,
    );
    expect(service.isPdfBook('application/epub+zip', 'books/x.epub')).toBe(
      false,
    );
  });

  it('extractFingerprint returns null when field missing', async () => {
    const raw = await minimalPdfBytes();
    const out = await service.extractFingerprint(raw);
    expect(out).toBeNull();
  });

  it('exposes stable field name constant', () => {
    expect(BOOK_PDF_FINGERPRINT_FIELD).toBe('bn.fp.v1');
  });
});
