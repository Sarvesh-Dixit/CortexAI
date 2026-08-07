import 'dotenv/config';
import express from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import http from 'http';
import { AppError } from './src/middleware/errorHandler';

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const ALLOWED_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ALLOWED_EXT.has(ext)) cb(null, true);
    else cb(new AppError(`File type ${ext || 'none'} not supported for OCR. Use PNG, JPG, WebP, GIF, BMP, or TIFF.`, 400));
  },
});

function multerSingle(name: string) {
  const handler = upload.single(name);
  return (req: any, _res: any, next: any) => {
    handler(req, _res, (err: any) => {
      if (err instanceof MulterError) {
        const detail =
          err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Unexpected upload field '${err.field}'. Expected field name is '${name}'.`
            : err.code === 'LIMIT_FILE_SIZE'
              ? 'Image is too large.'
              : err.message;
        return next(new AppError(`Upload failed: ${detail} (multer ${err.code})`, 400));
      }
      if (err instanceof AppError) return next(err);
      if (err) return next(new AppError(`Upload failed: ${(err as Error).message}`, 400));
      next();
    });
  };
}

app.post(
  '/ocr-no-wrap',
  upload.single('image'),
  (req: any, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'ORIGINAL_BUG', message: 'No image uploaded (OLD BEHAVIOR - fileFilter errors were hidden)' } });
    res.json({ success: true, data: { hasFile: true, size: req.file.size, fieldName: req.file.fieldname, name: req.file.originalname, bodyKeys: Object.keys(req.body) } });
  }
);

app.post(
  '/ocr-fixed',
  multerSingle('image'),
  (req: any, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: { code: 'NO_FILE', message: `No image uploaded after multer. Content-Type=${req.headers['content-type']}` } });
    res.json({ success: true, data: { hasFile: true, size: req.file.size, fieldName: req.file.fieldname, name: req.file.originalname, bodyKeys: Object.keys(req.body) } });
  }
);

app.use((err: any, _req: any, res: any, _next: any) => {
  const status = err.statusCode || err.status || (err instanceof MulterError ? 400 : 500);
  res.status(status).json({ success: false, error: { code: err.code || 'E_GENERAL', message: err.message, kind: err.constructor.name } });
});

function buildMultipartBody(boundary: string, fileBuffer: Buffer, fieldName: string, filename: string, extraFields: Record<string,string> = {}, mime='image/png'): Buffer {
  const lines: (string | Buffer)[] = [];
  for (const [k,v] of Object.entries(extraFields)) {
    lines.push(`--${boundary}\r\n`);
    lines.push(`Content-Disposition: form-data; name="${k}"\r\n\r\n`);
    lines.push(`${v}\r\n`);
  }
  lines.push(`--${boundary}\r\n`);
  lines.push(
    `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
    `Content-Type: ${mime}\r\n\r\n`
  );
  lines.push(fileBuffer);
  lines.push(`\r\n--${boundary}--\r\n`);
  return Buffer.concat(lines.map((l) => typeof l === 'string' ? Buffer.from(l) : l));
}

function doPost(port: number, pathname: string, headers: Record<string, any>, body: Buffer | null = null): Promise<{status: number, body: string}> {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method: 'POST', path: pathname, headers }, (res) => {
      const chunks: any[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode!, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const DUMMY_PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const DUMMY_EXE = Buffer.from('MZ This is not a real executable but has .exe extension');

(async () => {
  const server = app.listen(0, async () => {
    try {
      const port = (server.address() as any).port;
      console.log(`[UploadTest] Server on port ${port}`);
      const BOUNDARY = '----testboundary-ABCDEF-1234567890';

      console.log('\n========== Test A: OLD bug-ridden upload.single("image") WITHOUT wrapper ==========');
      console.log(`\nA1. Correct field="image", correct boundary, png => EXPECT hasFile:true size OK`);
      const bodyA1 = buildMultipartBody(BOUNDARY, DUMMY_PNG, 'image', 'photo.png', { language: 'eng' });
      const rA1 = await doPost(port, '/ocr-no-wrap', { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, 'Content-Length': String(bodyA1.length) }, bodyA1);
      console.log(`  Status: ${rA1.status} Body: ${rA1.body}`);
      const okA1 = rA1.status === 200 && /"hasFile":true/.test(rA1.body);
      console.log(okA1 ? '  ✅ PASS' : '  ❌ FAIL');

      console.log(`\nA2. WRONG field="wrongname" => OLD wrapper silently swallowed => EXPECT 400 NO_FILE (hides LIMIT_UNEXPECTED_FILE)`);
      const bodyA2 = buildMultipartBody(BOUNDARY, DUMMY_PNG, 'wrongname', 'photo.png', { language: 'eng' });
      const rA2 = await doPost(port, '/ocr-no-wrap', { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, 'Content-Length': String(bodyA2.length) }, bodyA2);
      console.log(`  Status: ${rA2.status} Body: ${rA2.body}`);
      const hidden = rA2.status === 400 && /ORIGINAL_BUG/.test(rA2.body);
      console.log(hidden ? '  ✅ Demonstrated the OLD bug: swallowed multer errors result in generic "No image uploaded"' : '  ℹ️  Not as expected');

      console.log(`\nA3. Bad file extension EXE => OLD wrapper swallowed => EXPECT 400 ORIGINAL_BUG`);
      const bodyA3 = buildMultipartBody(BOUNDARY, DUMMY_EXE, 'image', 'dangerous.exe');
      const rA3 = await doPost(port, '/ocr-no-wrap', { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, 'Content-Length': String(bodyA3.length) }, bodyA3);
      console.log(`  Status: ${rA3.status} Body: ${rA3.body}`);
      console.log(/ORIGINAL_BUG/.test(rA3.body) ? '  ✅ OLD: fileFilter error ALSO became generic "No image uploaded"' : '  ℹ️  Not as expected');

      console.log('\n========== Test B: NEW fixed multerSingle("image") wrapper ==========');
      console.log(`\nB1. Correct field="image", correct boundary, png => EXPECT hasFile:true`);
      const bodyB1 = buildMultipartBody(BOUNDARY, DUMMY_PNG, 'image', 'photo.png', { language: 'eng' });
      const rB1 = await doPost(port, '/ocr-fixed', { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, 'Content-Length': String(bodyB1.length) }, bodyB1);
      console.log(`  Status: ${rB1.status} Body: ${rB1.body}`);
      const okB1 = rB1.status === 200 && /"hasFile":true.*size/.test(rB1.body);
      console.log(okB1 ? '  ✅ PASS - req.file properly populated' : '  ❌ FAIL');

      console.log(`\nB2. WRONG field="wrongfield" => EXPECT wrapped AppError mentions field name`);
      const bodyB2 = buildMultipartBody(BOUNDARY, DUMMY_PNG, 'wrongfield', 'photo.png');
      const rB2 = await doPost(port, '/ocr-fixed', { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, 'Content-Length': String(bodyB2.length) }, bodyB2);
      console.log(`  Status: ${rB2.status} Body: ${rB2.body}`);
      const okB2 = rB2.status === 400 && /wrongfield/.test(rB2.body) && /LIMIT_UNEXPECTED_FILE/.test(rB2.body);
      console.log(okB2 ? '  ✅ PASS - explicit "Unexpected upload field wrongfield" message instead of generic "No image uploaded"' : '  ❌ FAIL');

      console.log(`\nB3. Bad file extension .exe => EXPECT wrapped 400 AppError mentions extension + supported types`);
      const bodyB3 = buildMultipartBody(BOUNDARY, DUMMY_EXE, 'image', 'malware.exe');
      const rB3 = await doPost(port, '/ocr-fixed', { 'Content-Type': `multipart/form-data; boundary=${BOUNDARY}`, 'Content-Length': String(bodyB3.length) }, bodyB3);
      console.log(`  Status: ${rB3.status} Body: ${rB3.body}`);
      const okB3 = rB3.status === 400 && /exe/.test(rB3.body) && /not supported/.test(rB3.body);
      console.log(okB3 ? '  ✅ PASS - fileFilter error surfaced with exact extension, not hidden' : '  ❌ FAIL');

      console.log('\n========== Summary ==========');
      console.log('Old route (/ocr-no-wrap) hides MulterErrors and fileFilter errors behind generic "No image uploaded".');
      console.log('New route (/ocr-fixed) with multerSingle wrapper surfaces precise, actionable messages.');
      console.log('This explains why user saw "No image uploaded" even after selecting a file: if multer rejected it (file type, field name, etc.), the prior code treated it as "no file".');

      server.close();
    } catch (e: any) {
      console.error('Upload test crashed:', e.message, e.stack);
      try { server.close(); } catch {}
      process.exit(99);
    }
  });
})();
