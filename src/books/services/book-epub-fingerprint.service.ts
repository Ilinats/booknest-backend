import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type JSZipRef from 'jszip';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require('jszip') as typeof JSZipRef;
import {
  BookFingerprintPayload,
  signBookFingerprintToken,
  verifyBookFingerprintToken,
  getBookFingerprintSecret,
} from './book-fingerprint-token';
import { BookErrors } from '../errors/book-errors';

/** Reserved file inside the EPUB container (ZIP) holding the signed token. */
export const BOOK_EPUB_FINGERPRINT_ZIP_PATH =
  'META-INF/com.booknest.fingerprint.v1';

@Injectable()
export class BookEpubFingerprintService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = getBookFingerprintSecret(this.configService);
  }

  isEpubBook(fileType: string | null | undefined, fileKey: string): boolean {
    const t = (fileType || '').toLowerCase();
    if (t.includes('epub')) return true;
    return fileKey.toLowerCase().endsWith('.epub');
  }

  async embedFingerprint(
    epubBuffer: Buffer,
    params: { bookId: string; readerId: string },
  ): Promise<Buffer> {
    const payload: BookFingerprintPayload = {
      bookId: params.bookId,
      readerId: params.readerId,
      iat: Math.floor(Date.now() / 1000),
    };
    const token = signBookFingerprintToken(this.secret, payload);
    let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
    try {
      zip = await JSZip.loadAsync(epubBuffer);
    } catch {
      throw new BadRequestException(BookErrors.BOOK_EPUB_FINGERPRINT_FAILED);
    }
    const mimetype = zip.file('mimetype');
    if (!mimetype) {
      throw new BadRequestException(BookErrors.BOOK_EPUB_INVALID);
    }
    const mimetypeBody = (await mimetype.async('string')).replace(/\r/g, '');
    if (!mimetypeBody.trim().startsWith('application/epub+zip')) {
      throw new BadRequestException(BookErrors.BOOK_EPUB_INVALID);
    }
    zip.file(BOOK_EPUB_FINGERPRINT_ZIP_PATH, `${token}\n`, {
      compression: 'STORE',
    });
    try {
      const out = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });
      return Buffer.from(out);
    } catch {
      throw new BadRequestException(BookErrors.BOOK_EPUB_FINGERPRINT_FAILED);
    }
  }

  async extractFingerprint(
    epubBuffer: Buffer,
  ): Promise<BookFingerprintPayload | null> {
    let zip: Awaited<ReturnType<typeof JSZip.loadAsync>>;
    try {
      zip = await JSZip.loadAsync(epubBuffer);
    } catch {
      return null;
    }
    const entry = zip.file(BOOK_EPUB_FINGERPRINT_ZIP_PATH);
    if (!entry) return null;
    const raw = (await entry.async('string')).trim();
    if (!raw) return null;
    return verifyBookFingerprintToken(this.secret, raw);
  }
}
