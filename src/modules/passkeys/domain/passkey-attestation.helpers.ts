// SPDX-License-Identifier: FSL-1.1-MIT
import { timingSafeEqual } from 'node:crypto';
import { PasskeyAttestationError } from '@/modules/passkeys/domain/errors/passkey-attestation.error';

/**
 * Minimal shape we read from a decoded clientDataJSON. The full WebAuthn
 * object has many more fields; we only need `type` here.
 */
export interface ClientDataJSON {
  type?: string;
}

/**
 * Type guard for the decoded clientDataJSON payload. Accepts any non-array
 * object — extra fields are tolerated, but a string `type` (when present) is
 * required so callers do not have to re-narrow.
 */
export function isClientDataJSON(value: unknown): value is ClientDataJSON {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if (!('type' in value)) return true;
  const type = (value as { type: unknown }).type;
  return typeof type === 'string' || typeof type === 'undefined';
}

/**
 * Decode a base64url-encoded clientDataJSON string into its parsed object
 * form. Throws {@link PasskeyAttestationError} with
 * `PASSKEY_MALFORMED_ATTESTATION` for any decode/parse failure or shape
 * mismatch — callers never see the underlying SyntaxError.
 */
export function parseClientDataJSON(b64url: string): ClientDataJSON {
  let parsed: unknown;
  try {
    const raw = Buffer.from(b64url, 'base64url').toString('utf8');
    parsed = JSON.parse(raw);
  } catch {
    throw new PasskeyAttestationError('PASSKEY_MALFORMED_ATTESTATION');
  }
  if (!isClientDataJSON(parsed)) {
    throw new PasskeyAttestationError('PASSKEY_MALFORMED_ATTESTATION');
  }
  return parsed;
}

/**
 * Constant-time string comparison for base64url-encoded values. When the
 * inputs differ in length we still run `timingSafeEqual` on a padded copy so
 * the comparison cost is independent of the mismatch position.
 */
export function timingSafeEqualBase64Url(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    const max = Math.max(ab.length, bb.length);
    const apad = Buffer.alloc(max);
    const bpad = Buffer.alloc(max);
    ab.copy(apad);
    bb.copy(bpad);
    timingSafeEqual(apad, bpad);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

/**
 * Left-pad a byte buffer to exactly 32 bytes (big-endian P-256 coordinate
 * width). Inputs longer than 32 bytes are rejected as an unsupported key.
 */
export function pad32(buf: Uint8Array): Buffer {
  if (buf.length > 32) {
    throw new PasskeyAttestationError('PASSKEY_UNSUPPORTED_KEY');
  }
  if (buf.length === 32) return Buffer.from(buf);
  const out = Buffer.alloc(32);
  out.set(buf, 32 - buf.length);
  return out;
}
