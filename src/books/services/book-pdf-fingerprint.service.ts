import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PDFDocument, PDFTextField } from 'pdf-lib';
import {
  BookFingerprintPayload,
  signBookFingerprintToken,
  verifyBookFingerprintToken,
  getBookFingerprintSecret,
} from './book-fingerprint-token';

/** Internal AcroForm field storing a signed reader fingerprint (extractable for leak analysis). */
export const BOOK_PDF_FINGERPRINT_FIELD = 'bn.fp.v1';

/** @deprecated Use BookFingerprintPayload */
export type PdfFingerprintPayload = BookFingerprintPayload;

@Injectable()
export class BookPdfFingerprintService {
  private readonly secret: string;

  constructor(private readonly configService: ConfigService) {
    this.secret = getBookFingerprintSecret(this.configService);
  }

  isPdfBook(fileType: string | null | undefined, fileKey: string): boolean {
    const t = (fileType || '').toLowerCase();
    if (t.includes('pdf')) return true;
    return fileKey.toLowerCase().endsWith('.pdf');
  }

  verifyToken(token: string): BookFingerprintPayload | null {
    return verifyBookFingerprintToken(this.secret, token);
  }

  async embedFingerprint(
    pdfBuffer: Buffer,
    params: { bookId: string; readerId: string },
  ): Promise<Buffer> {
    const payload: BookFingerprintPayload = {
      bookId: params.bookId,
      readerId: params.readerId,
      iat: Math.floor(Date.now() / 1000),
    };
    const token = signBookFingerprintToken(this.secret, payload);
    const pdfDoc = await PDFDocument.load(pdfBuffer, {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      pdfDoc.addPage();
    }
    const targetPage = pdfDoc.getPages()[pdfDoc.getPageCount() - 1];
    const form = pdfDoc.getForm();

    let textField: PDFTextField;
    const existing = form.getFieldMaybe(BOOK_PDF_FINGERPRINT_FIELD);
    if (existing instanceof PDFTextField) {
      textField = existing;
    } else {
      textField = form.createTextField(BOOK_PDF_FINGERPRINT_FIELD);
      textField.addToPage(targetPage, {
        x: -5000,
        y: -5000,
        width: 1,
        height: 1,
      });
    }
    textField.removeMaxLength();
    textField.setText(token);
    textField.disableScrolling();
    textField.disableMultiline();

    const out = await pdfDoc.save({ useObjectStreams: false });
    return Buffer.from(out);
  }

  async extractFingerprint(
    pdfBuffer: Buffer,
  ): Promise<BookFingerprintPayload | null> {
    let pdfDoc: PDFDocument;
    try {
      pdfDoc = await PDFDocument.load(pdfBuffer, {
        ignoreEncryption: false,
      });
    } catch {
      return null;
    }
    const form = pdfDoc.getForm();
    const existing = form.getFieldMaybe(BOOK_PDF_FINGERPRINT_FIELD);
    if (!(existing instanceof PDFTextField)) {
      return null;
    }
    const token = existing.getText();
    if (!token?.trim()) return null;
    return this.verifyToken(token.trim());
  }
}
