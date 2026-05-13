import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require('jszip') as typeof import('jszip');
import {
  BookEpubFingerprintService,
  BOOK_EPUB_FINGERPRINT_ZIP_PATH,
} from './book-epub-fingerprint.service';

async function minimalEpubBuffer(): Promise<Buffer> {
  const zip = new JSZip();
  zip.file('mimetype', 'application/epub+zip\n', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
    { compression: 'DEFLATE' },
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>T</dc:title>
    <dc:identifier id="uid">id</dc:identifier>
    <meta property="dcterms:modified">2020-01-01T00:00:00Z</meta>
  </metadata>
  <manifest>
    <item id="n" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
  </manifest>
  <spine><itemref idref="n"/></spine>
</package>`,
    { compression: 'DEFLATE' },
  );
  zip.file(
    'OEBPS/nav.xhtml',
    '<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><nav epub:type="toc" xmlns:epub="http://www.idpf.org/2007/ops"><h1>t</h1><ol></ol></nav></body></html>',
    { compression: 'DEFLATE' },
  );
  return Buffer.from(
    await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
    }),
  );
}

describe('BookEpubFingerprintService', () => {
  let service: BookEpubFingerprintService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BookEpubFingerprintService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              key === 'BOOK_PDF_FINGERPRINT_SECRET' ? 'test-secret-key' : '',
          },
        },
      ],
    }).compile();
    service = moduleRef.get(BookEpubFingerprintService);
  });

  it('round-trips fingerprint in a minimal EPUB', async () => {
    const raw = await minimalEpubBuffer();
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
    const zip = await JSZip.loadAsync(marked);
    expect(zip.file(BOOK_EPUB_FINGERPRINT_ZIP_PATH)).toBeTruthy();
  });

  it('isEpubBook detects epub by mime or extension', () => {
    expect(service.isEpubBook('application/epub+zip', 'books/x.pdf')).toBe(
      true,
    );
    expect(service.isEpubBook('application/pdf', 'books/x.epub')).toBe(true);
    expect(service.isEpubBook('application/pdf', 'books/x.pdf')).toBe(false);
  });

  it('extractFingerprint returns null when zip has no marker', async () => {
    const raw = await minimalEpubBuffer();
    expect(await service.extractFingerprint(raw)).toBeNull();
  });
});
