import 'dotenv/config';
import { ocrService } from './src/services/ocr.service';

const HELLO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function main() {
  console.log('[SmokeTest] Starting OCR smoke test...');
  const buf = Buffer.from(HELLO_PNG_BASE64, 'base64');
  console.log(`[SmokeTest] Input buffer: ${buf.length} bytes`);

  try {
    const deadline = setTimeout(() => {
      console.error('[SmokeTest] OVERALL TIMEOUT reached after 180s — FAIL (service did not settle)');
      process.exit(1);
    }, 180_000);

    console.log('[SmokeTest] Calling ocrService.extractFromBuffer (timeout=120s)...');
    const started = Date.now();
    try {
      const result = await ocrService.extractFromBuffer(buf, 'eng', 120_000);
      clearTimeout(deadline);
      const elapsed = Date.now() - started;
      console.log(`[SmokeTest] SUCCESS in ${elapsed}ms`);
      console.log(
        `[SmokeTest] words=${result.words} chars=${result.characters} conf=${result.confidence.toFixed(1)}% text.length=${result.text.length}`
      );
      if (result.text.length > 0) {
        console.log(`[SmokeTest] Sample text: ${JSON.stringify(result.text.slice(0, 200))}`);
      }
      process.exit(0);
    } catch (err) {
      clearTimeout(deadline);
      const elapsed = Date.now() - started;
      const e = err as Error & { statusCode?: number };
      console.error(
        `[SmokeTest] Service returned ERROR in ${elapsed}ms: ${e.message} (statusCode=${e.statusCode ?? 'none'})`
      );
      if (e.statusCode === 422) {
        console.log('[SmokeTest] 422 means image had no text — timeout/init logic WORKS. Pass.');
        process.exit(0);
      }
      if (e.statusCode === 504) {
        console.log('[SmokeTest] 504 means timeout FIRED — timeout logic WORKS. Fix cache/network.');
        process.exit(2);
      }
      console.error(e.stack);
      process.exit(3);
    }
  } finally {
    try {
      await ocrService.terminate();
    } catch {
      /* ignore */
    }
  }
}

main().catch((e) => {
  console.error('[SmokeTest] FATAL:', e);
  process.exit(99);
});
