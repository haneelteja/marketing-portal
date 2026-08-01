import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM at-rest encryption for social OAuth tokens (spec §13).
 * Key from env/KMS (32 bytes, base64). Plaintext tokens are never logged and
 * never serialized into any API response — decrypt() is called only inside
 * services/publisher workers immediately before a platform API call.
 */
const ALG = 'aes-256-gcm';

function key(): Buffer {
  const raw = process.env.TOKEN_VAULT_KEY;
  if (!raw) throw new Error('TOKEN_VAULT_KEY is not set');
  const k = Buffer.from(raw, 'base64');
  if (k.length !== 32) throw new Error('TOKEN_VAULT_KEY must be 32 bytes (base64)');
  return k;
}

export function encryptToken(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ct].map((b) => b.toString('base64')).join('.');
}

export function decryptToken(stored: string): string {
  const [iv, tag, ct] = stored.split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = createDecipheriv(ALG, key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
