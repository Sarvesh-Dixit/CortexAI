/**
 * AES-256-GCM encryption for sensitive data at rest (API keys, tokens).
 *
 * Storage format (base64-encoded):  IV(12) || TAG(16) || CIPHERTEXT
 *
 * The encryption key comes from ENCRYPTION_KEY env var — a 32-byte
 * (64-hex-char) random value. Rotating this key requires re-encrypting
 * all stored secrets. NEVER commit or share the key.
 *
 * Also provides SHA-256 hashing for tokens and fingerprints — these
 * are one-way and used for lookups/duplicate detection without ever
 * having to decrypt.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM standard
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) {
    const hint = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
      ? ' Add it in Vercel Project Settings → Environment Variables.'
      : ' Generate one with:  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"';
    throw new Error('ENCRYPTION_KEY environment variable is not set.' + hint);
  }

  const key = Buffer.from(hex, 'hex');
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly ${KEY_LENGTH} bytes (${KEY_LENGTH * 2} hex chars). ` +
      `Got ${key.length} bytes.`
    );
  }

  cachedKey = key;
  return key;
}

/**
 * Encrypt a plaintext string. Output is base64-encoded and safe for DB storage.
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // IV || TAG || CIPHERTEXT  →  base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a previously-encrypted payload. Throws if tampered or wrong key.
 */
export function decrypt(payload: string): string {
  if (!payload) return '';
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Invalid encrypted payload: too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * SHA-256 hex digest. Used for token hashes and secret fingerprints.
 * One-way — cannot be reversed.
 */
export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

/**
 * Take the first `n` characters of a plaintext key for UI display,
 * masking the rest. e.g. "sk-abcd..." for "sk-abcdef123456...".
 */
export function keyPrefix(plaintext: string, chars = 8): string {
  if (!plaintext) return '';
  return plaintext.slice(0, chars);
}

/**
 * Constant-time comparison to avoid timing attacks on secrets.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
