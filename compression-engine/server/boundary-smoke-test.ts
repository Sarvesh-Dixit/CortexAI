import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';

const app = express();

const upload = multer({ storage: multer.memoryStorage() });

const GOOD_MIME = 'multipart/form-data; boundary=------------------------123456789012345678901234';
const BAD_MIME = 'multipart/form-data';

const BUFFER = Buffer.from('hello');
const BOUNDARY = '------------------------123456789012345678901234';
const FIELD_NAME = 'image';
const FILENAME = 'test.txt';

function buildMultipartBody(boundary: string, fileBuffer: Buffer, fieldName: string, filename: string, extraFields: Record<string, string> = {}): Buffer {
  const lines: (string | Buffer)[] = [];
  for (const [k, v] of Object.entries(extraFields)) {
    lines.push(`--${boundary}\r\n`);
    lines.push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
    lines.push(`${v}\r\n`);
  }
  lines.push(`--${boundary}\r\n`);
  lines.push(
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`
  );
  lines.push(fileBuffer);
  lines.push(`\r\n--${boundary}--\r\n`);
  return Buffer.concat(lines.map((l) => (typeof l === 'string' ? Buffer.from(l) : l)));
}

function makeRequest(method: string, path: string, headers: Record<string, string | number>, body?: Buffer) {
  return new Promise<{ statusCode: number; body: string; headers: any }>((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = (server.address() as any).port;
      const http = require('http');
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers,
        },
        (res: any) => {
          const chunks: any[] = [];
          res.on('data', (c: any) => chunks.push(c));
          res.on('end', () => {
            server.close();
            resolve({
              statusCode: res.statusCode,
              headers: res.headers,
              body: Buffer.concat(chunks).toString('utf8'),
            });
          });
        }
      );
      req.on('error', reject);
      if (body) req.write(body);
      req.end();
    });
    server.on('error', reject);
  });
}

app.post('/with-boundary', upload.single('image'), (req: any, res) => {
  res.json({
    hasFile: !!req.file,
    fileSize: req.file?.size,
    fieldName: req.file?.fieldname,
    origName: req.file?.originalname,
    lang: req.body?.language,
  });
});

app.post('/without-boundary', upload.single('image'), (req: any, res) => {
  res.json({
    hasFile: !!req.file,
    fileSize: req.file?.size,
    lang: req.body?.language,
  });
});

(async () => {
  const body = buildMultipartBody(BOUNDARY, BUFFER, FIELD_NAME, FILENAME, { language: 'eng' });

  console.log('[Test 1] POST with proper Content-Type WITH boundary=... (like fixed axios does)');
  const r1 = await makeRequest('POST', '/with-boundary', {
    'Content-Type': GOOD_MIME,
    'Content-Length': body.length,
  }, body);
  console.log(`  -> Status ${r1.statusCode}, body: ${r1.body}`);
  const parsed1 = JSON.parse(r1.body);
  if (parsed1.hasFile && parsed1.lang === 'eng') {
    console.log('  ✅ PASS: req.file + req.body.language both parsed correctly.');
  } else {
    console.log('  ❌ FAIL: fields missing!');
    process.exitCode = 1;
  }

  console.log('\n[Test 2] POST with manual Content-Type WITHOUT boundary (like the bug we fixed)');
  try {
    const r2 = await makeRequest('POST', '/without-boundary', {
      'Content-Type': BAD_MIME,
      'Content-Length': body.length,
    }, body);
    console.log(`  -> Status ${r2.statusCode}, body: ${r2.body}`);
    const parsed2 = JSON.parse(r2.body);
    if (!parsed2.hasFile) {
      console.log('  ✅ PASS: missing boundary breaks multer, as expected — this was the root cause of "No image uploaded".');
    } else {
      console.log('  ⚠️ Unexpected: multer still parsed it?');
    }
  } catch (e: any) {
    console.log(`  -> Error (multer may reject): ${e.message}`);
  }

  console.log('\nConclusion: Always let FormData/axios generate multipart Content-Type WITH boundary automatically.');
})();
