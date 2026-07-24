// SPDX-License-Identifier: FSL-1.1-MIT
import { createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  BLIND_INDEX_LABEL,
  ENCRYPTION_PREFIX,
  ENCRYPTION_VERSION,
  ENVELOPE_IV_BYTES,
  ENVELOPE_KEY_LENGTH_BYTES,
  ENVELOPE_TAG_BYTES,
  INDEX_KEY_LENGTH,
} from '@/datasources/kms/encryption.constants';
import { IKmsService } from '@/datasources/kms/kms.service.interface';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  canonicalContext,
} from '@/domain/common/utils/encryption';

/**
 * The single, domain-free crypto mechanics for all field-level encryption,
 * built on the stateless {@link IKmsService}. Per-entity policy (which owner,
 * how to shape the context, batch helpers) lives in thin wrappers:
 * UserEncryptionService, WalletEncryptionService, MemberEncryptionService,
 * SpaceEncryptionService — this service knows nothing about scopes.
 *
 * - {@link encrypt}/{@link decrypt}: envelope encryption. Each value gets a
 *   fresh KMS data key; the caller-supplied `encryptionContext` is passed to
 *   KMS as AAD and cryptographically bound into the wrapped key (and bound
 *   again locally as GCM AAD) — decryption fails unless the identical context
 *   is presented, so a value cannot be transplanted to another owner. KMS
 *   only ever sees the 32-byte data key, never the value, so values of any
 *   size encrypt (the KMS Encrypt API itself caps plaintext at 4096 bytes,
 *   which audit payloads can exceed). Wrappers own the context shape and bind
 *   the owning row's id into it (e.g. `{ userId }` or `{ spaceId }`).
 * - {@link blindIndex}: deterministic keyed HMAC over the normalised value,
 *   stored in a sibling `*_index` column so uniqueness and equality lookups
 *   keep working while the value itself is encrypted non-deterministically.
 *   One global HMAC domain and one shared key.
 *
 * Encryption is gated centrally here so wrappers can call unconditionally:
 * - disabled → plaintext passthrough (no KMS), though ciphertext reads still
 *   decrypt (rollback safety);
 * - enabled → values are always encrypted on write, and reads decrypt
 *   ciphertext; a plaintext value read while enabled is a hard error (all
 *   rows are expected to be encrypted, having been backfilled beforehand).
 */
@Injectable()
export class KmsEncryptionService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly wrappedIndexKey: string | undefined;
  /** Unwrapped blind-index key; populated on init whenever configured. */
  private indexKey: Buffer | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    @Inject(IKmsService)
    private readonly kmsService: IKmsService,
  ) {
    this.enabled =
      this.configurationService.getOrThrow<boolean>('encryption.enabled');
    this.wrappedIndexKey = this.configurationService.get<string>(
      'encryption.indexKey',
    );
  }

  /**
   * Unwraps the configured blind-index key via KMS once, before requests are
   * served, so a misconfiguration fails at boot rather than on the first
   * write. Unwrapped whenever configured, even if encryption is disabled, so
   * existing blind indexes stay computable (e.g. after a rollback).
   */
  async onModuleInit(): Promise<void> {
    if (this.wrappedIndexKey) {
      const plaintext = await this.kmsService.decrypt({
        ciphertext: Buffer.from(this.wrappedIndexKey, 'base64'),
      });
      if (plaintext.length !== INDEX_KEY_LENGTH) {
        throw new Error(
          `The blind-index key must be ${INDEX_KEY_LENGTH} bytes, got ${plaintext.length}`,
        );
      }
      this.indexKey = plaintext;
    }
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${ENCRYPTION_PREFIX}:`);
  }

  /**
   * Envelope-encrypts a value, bound to the caller-supplied
   * `encryptionContext`: a fresh per-value data key — wrapped by KMS under
   * the context as AAD, so the same binding applies as if KMS encrypted the
   * value itself — encrypts the value locally with AES-256-GCM, the
   * canonicalised context bound again as GCM AAD. KMS never sees the value,
   * so no KMS plaintext-size limit applies. Returns the plaintext unchanged
   * when encryption is disabled. Stored form:
   * `kms:v1:<base64url(keyLen || wrappedKey || iv || ciphertext || tag)>`.
   */
  async encrypt(
    value: string,
    encryptionContext: Record<string, string>,
  ): Promise<string> {
    if (!this.enabled) {
      return value;
    }
    const { plaintextKey, wrappedKey } = await this.kmsService.generateDataKey({
      encryptionContext,
    });
    try {
      const { iv, ciphertext, tag } = aesGcmEncrypt({
        plaintext: Buffer.from(value, 'utf8'),
        key: plaintextKey,
        aad: canonicalContext(encryptionContext),
        ivLength: ENVELOPE_IV_BYTES,
      });
      const keyLength = Buffer.alloc(ENVELOPE_KEY_LENGTH_BYTES);
      keyLength.writeUInt16BE(wrappedKey.length, 0);
      const blob = Buffer.concat([keyLength, wrappedKey, iv, ciphertext, tag]);
      return `${ENCRYPTION_PREFIX}:${ENCRYPTION_VERSION}:${blob.toString('base64url')}`;
    } finally {
      // Data keys are single-use; drop the key material eagerly.
      plaintextKey.fill(0);
    }
  }

  /**
   * Reverse of {@link encrypt}. `kms:` ciphertext is always decrypted: the
   * stored data key is unwrapped via KMS using the caller-supplied
   * `encryptionContext` as AAD, then the value is decrypted locally (the
   * canonicalised context checked again as GCM AAD). A plaintext value passes
   * through unchanged only while encryption is disabled (rollback/off); while
   * enabled every row is expected to be encrypted, so plaintext is a hard
   * error rather than a silent passthrough.
   *
   * The empty string is exempt from that hard error and always passes
   * through: the app never writes blank values and the backfill deliberately
   * skips them (invalid data a `--verify` gate flags, never leaves
   * encrypted), so `''` never has a ciphertext form to expect.
   * Short-circuiting here keeps a stray blank value from bricking a read
   * path once the flag is on.
   */
  async decrypt(
    value: string,
    encryptionContext: Record<string, string>,
  ): Promise<string> {
    if (value === '') {
      return value;
    }
    if (!this.isEncrypted(value)) {
      if (this.enabled) {
        throw new Error('Expected ciphertext but got a plaintext value');
      }
      return value;
    }
    const parts = value.split(':');
    if (parts.length !== 3 || parts[1] !== ENCRYPTION_VERSION || !parts[2]) {
      throw new Error('Malformed ciphertext');
    }
    const blob = Buffer.from(parts[2], 'base64url');
    if (blob.length < ENVELOPE_KEY_LENGTH_BYTES) {
      throw new Error('Malformed ciphertext');
    }
    const wrappedKeyLength = blob.readUInt16BE(0);
    const wrappedKeyEnd = ENVELOPE_KEY_LENGTH_BYTES + wrappedKeyLength;
    const ivEnd = wrappedKeyEnd + ENVELOPE_IV_BYTES;
    const tagStart = blob.length - ENVELOPE_TAG_BYTES;
    if (wrappedKeyLength === 0 || ivEnd > tagStart) {
      throw new Error('Malformed ciphertext');
    }
    const plaintextKey = await this.kmsService.decrypt({
      ciphertext: blob.subarray(ENVELOPE_KEY_LENGTH_BYTES, wrappedKeyEnd),
      encryptionContext,
    });
    try {
      return aesGcmDecrypt({
        ciphertext: blob.subarray(ivEnd, tagStart),
        key: plaintextKey,
        iv: blob.subarray(wrappedKeyEnd, ivEnd),
        tag: blob.subarray(tagStart),
        aad: canonicalContext(encryptionContext),
      }).toString('utf8');
    } finally {
      plaintextKey.fill(0);
    }
  }

  /**
   * Deterministic keyed HMAC (base64url) over the normalised (trimmed,
   * lower-cased) input, over a single global HMAC domain, used as a blind
   * index for searchable/unique columns. Gated on the index key being
   * configured, not on {@link enabled}: once rows carry a blind index,
   * disabling the flag again must not stop lookups from matching them
   * (rollback safety). Returns `null` only when no key is configured at all,
   * in which case callers store/look up the plaintext value directly.
   */
  blindIndex(value: string): string | null {
    if (!this.indexKey) {
      return null;
    }
    return createHmac('sha256', this.indexKey)
      .update(BLIND_INDEX_LABEL)
      .update('\0')
      .update(value.trim().toLowerCase(), 'utf8')
      .digest('base64url');
  }
}
