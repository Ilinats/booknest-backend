import { createHmac, timingSafeEqual } from 'crypto';

export type BookFingerprintPayload = {
  bookId: string;
  readerId: string;
  iat: number;
};

export function signBookFingerprintToken(
  secret: string,
  payload: BookFingerprintPayload,
): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyBookFingerprintToken(
  secret: string,
  token: string,
): BookFingerprintPayload | null {
  const trimmed = token.trim();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const body = trimmed.slice(0, lastDot);
  const sig = trimmed.slice(lastDot + 1);
  const expected = createHmac('sha256', secret)
    .update(body)
    .digest('base64url');
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const json = Buffer.from(body, 'base64url').toString('utf8');
    const data = JSON.parse(json) as BookFingerprintPayload;
    if (
      typeof data.bookId === 'string' &&
      typeof data.readerId === 'string' &&
      typeof data.iat === 'number'
    ) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

export function getBookFingerprintSecret(config: {
  get: (key: string) => string | undefined;
}): string {
  const secret =
    config.get('BOOK_PDF_FINGERPRINT_SECRET') ||
    config.get('BOOK_EPUB_FINGERPRINT_SECRET') ||
    config.get('JWT_SECRET') ||
    '';
  if (!secret) {
    throw new Error(
      'BOOK_PDF_FINGERPRINT_SECRET, BOOK_EPUB_FINGERPRINT_SECRET, or JWT_SECRET must be set for book file fingerprinting',
    );
  }
  return secret;
}
