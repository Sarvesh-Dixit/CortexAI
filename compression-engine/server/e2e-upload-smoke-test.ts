import 'dotenv/config';
import { ocrRouter } from './src/routes/ocr.routes';
import { documentRouter } from './src/routes/document.routes';
import express from 'express';
import multer, { MulterError } from 'multer';

const app = express();
app.use(express.json());

let tokenCounter = 1;

function fakeAuthenticate(req: any, _res: any, next: any) {
  req.userId = `test-${tokenCounter++}`;
  next();
}

app.use('/ocr', fakeAuthenticate, (req, _, next) => {
  (ocrRouter as any)(req, _, next);
});
app.use('/documents', fakeAuthenticate, (req, _, next) => {
  (documentRouter as any)(req, _, next);
});

app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('[TEST MW Error]:', err.constructor.name, err.message);
  if (err instanceof MulterError) {
    return res.status(400).json({
      success: false,
      error: { code: 'E_MULTER_' + err.code, message: `multer ${err.code}: field=${err.field} detail=${err.message}` },
    });
  }
  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    success: false,
    error: { code: err.code || 'E_TEST', message: err.message },
  });
});

import http from 'http';

function buildMultipartBody(boundary: string, fileBuffer: Buffer, fieldName: string, filename: string, extraFields: Record<string,string> = {}): Buffer {
  const lines: (string | Buffer)[] = [];
  for (const [k,v] of Object.entries(extraFields)) {
    lines.push(`--${boundary}\r\n`);
    lines.push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
    lines.push(`${v}\r\n`);
  }
  lines.push(`--${boundary}\r\n`);
  lines.push(
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: image/png\r\n\r\n`
  );
  lines.push(fileBuffer);
  lines.push(`\r\n--${boundary}--\r\n`);
  return Buffer.concat(lines.map((l) => typeof l === 'string' ? Buffer.from(l) : l));
}

function doPost(port: number, pathname: string, headers: Record<string, any>, body: Buffer | null = null): Promise<{status: number, body: string, headers: any}> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method: 'POST',
      path: pathname,
      headers,
    }, (res) => {
      const chunks: any[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const DUMMY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

(async () => {
  const server = app.listen(0, async () => {
    try {
      const port = (server.address() as any).port;
      console.log(`[Test] Listening on http://127.0.0.1:${port}`);
      const BOUNDARY = '----testboundary1234567890ABCDEF';
      const body = buildMultipartBody(BOUNDARY, DUMMY_PNG, 'image', 'hello.png', { language: 'eng' });

      const GOOD_HEADERS = {
        Authorization: 'Bearer test',
        'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`,
        'Content-Length': String(body.length),
      };
      const NO_BOUNDARY_HEADERS = {
        Authorization: 'Bearer test',
        'Content-Type': 'multipart/form-data',
        'Content-Length': String(body.length),
      };
      const WRONG_FIELD = buildMultipartBody(BOUNDARY, DUMMY_PNG, 'wrongFieldName', 'hello.png', { language: 'eng' });

      console.log('\n=== Test 1: OCR /ocr/extract with proper boundary + field name = "image" (SHOULD PASS: req.file populated) ===');
      const r1 = await doPost(port, '/ocr/extract', GOOD_HEADERS, body);
      console.log(`Status: ${r1.status}`);
      console.log(`Body: ${r1.body}`);
      // Expect status 401 if auth fails or 422 from OCR "no text" (422 means file WAS parsed, route reached).
      if (r1.status === 422 || (r1.status === 400 && !/No image uploaded/.test(r1.body))) {
        console.log('✅ PASS: file parsed by multer, request reached OCR handler.');
      } else if (/No image uploaded/.test(r1.body) || r1.status === 500) {
        console.log('❌ FAIL: file was not populated!');
        process.exitCode = 1;
      } else {
        console.log('ℹ️  Test 1: not conclusive (status ' + r1.status + ')');
      }

      console.log('\n=== Test 2: OCR /ocr/extract WRONG field name "wrongFieldName" (SHOULD: 400 / LIMIT_UNEXPECTED_FILE or 400) ===');
      const r2 = await doPost(port, '/ocr/extract', {
        ...GOOD_HEADERS,
        'Content-Length': String(WRONG_FIELD.length),
      }, WRONG_FIELD);
      console.log(`Status: ${r2.status}`);
      console.log(`Body: ${r2.body}`);
      if (r2.status === 400 && /field.*wrongFieldName|LIMIT_UNEXPECTED_FILE/.test(r2.body)) {
        console.log('✅ PASS: wrong field explicitly reported via wrapped MulterError handler.');
      } else {
        console.log('ℹ️  Test 2 result: not explicitly wrapped?');
      }

      console.log('\n=== Test 3: Documents /documents/upload with field="file" and txt payload ===');
      const TXT = Buffer.from('hello documents world test content');
      const docBoundary = '----docboundary123';
      const docBody = buildMultipartBody(docBoundary, TXT, 'file', 'notes.txt');
      const r3 = await doPost(port, '/documents/upload', {
        Authorization: 'Bearer test',
        'Content-Type': `multipart/form-data; boundary=${docBoundary}`,
        'Content-Length': String(docBody.length),
      }, docBody);
      console.log(`Status: ${r3.status}`);
      console.log(`Body: ${r3.body}`);
      if (r3.status === 201 || (r3.status === 400 && /No file uploaded/.test(r3.body) === false)) {
        console.log('✅ PASS: /documents/upload parses field=file and works or fails gracefully with non-generic error');
      } else if (/No file uploaded/.test(r3.body)) {
        console.log('❌ FAIL: Documents route says No file uploaded!');
        process.exitCode = 1;
      }

      console.log('\n=== Test 4: OCR /ocr/extract WITH manual Content-Type multipart WITHOUT boundary (SHOULD fail with "Boundary not found" before handler) ===');
      const r4 = await doPost(port, '/ocr/extract', NO_BOUNDARY_HEADERS, body);
      console.log(`Status: ${r4.status}`);
      console.log(`Body: ${r4.body}`);
      if (r4.status === 500 || r4.status === 400) {
        console.log('ℹ️  Test 4: failure as expected - clients must include boundary. This is why we removed manual Content-Type header.');
      }

      server.close();
    } catch (e: any) {
      console.error('Test harness error:', e.message, e.stack);
      try { server.close(); } catch {}
      process.exit(99);
    }
  });
})();
