// SPDX-License-Identifier: FSL-1.1-MIT
import { createHmac } from 'node:crypto';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { KmsService } from '@/datasources/kms/kms.service';
import {
  BLIND_INDEX_LABEL,
  EMAIL_ENCRYPTION_PREFIX,
  EMAIL_ENCRYPTION_VERSION,
  EMAIL_FIELD,
  INDEX_KEY_LENGTH,
} from '@/modules/users/domain/email-encryption.constants';

/**
 * The single crypto policy for user-email field encryption, built on the
 * stateless {@link KmsService}.
 *
 * - {@link encrypt}/{@link decrypt}: the email value is encrypted directly by
 *   KMS. The encryption context (`{ userId, field }`) is cryptographically
 *   bound into the ciphertext — decryption fails unless the identical context
 *   is presented, so a value cannot be transplanted to another user or column.
 * - {@link blindIndex}: deterministic keyed HMAC over the normalised email,
 *   stored in `users.email_index` so uniqueness and equality lookups keep
 *   working while the value itself is encrypted non-deterministically. Its key
 *   is KMS-wrapped in config and unwrapped once at boot.
 *
 * Encryption is gated centrally here so the repository can call it
 * unconditionally:
 * - disabled → plaintext passthrough (no KMS), though ciphertext reads still
 *   decrypt (rollback safety);
 * - enabled → values are always encrypted on write and must be ciphertext on
 *   read; a plaintext row is an error (the backfill must complete before
 *   encryption is enabled).
 */
@Injectable()
export class EmailEncryptionService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly wrappedEmailIndexKey: string | undefined;
  /** Unwrapped blind-index key; populated on init whenever configured. */
  private emailIndexKey: Buffer | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly kmsService: KmsService,
  ) {
    this.enabled = this.configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.enabled',
    );
    this.wrappedEmailIndexKey = this.configurationService.get<string>(
      'spaces.fieldEncryption.emailIndexKey',
    );
  }

  /**
   * Unwraps the configured blind-index key via KMS once, before requests are
   * served, so a misconfiguration fails at boot rather than on the first
   * write. Unwrapped whenever configured, even if encryption is disabled, so
   * existing blind indexes stay computable (e.g. after a rollback).
   */
  async onModuleInit(): Promise<void> {
    if (this.wrappedEmailIndexKey) {
      const plaintext = await this.kmsService.decrypt({
        ciphertext: Buffer.from(this.wrappedEmailIndexKey, 'base64'),
      });
      if (plaintext.length !== INDEX_KEY_LENGTH) {
        throw new Error(
          `The blind-index key must be ${INDEX_KEY_LENGTH} bytes, got ${plaintext.length}`,
        );
      }
      this.emailIndexKey = plaintext;
    }
    if (this.enabled && !this.emailIndexKey) {
      throw new Error(
        'spaces.fieldEncryption.emailIndexKey is required when field encryption is enabled',
      );
    }
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${EMAIL_ENCRYPTION_PREFIX}:`);
  }

  /**
   * Deterministic keyed HMAC (base64url) over the normalised (trimmed,
   * lower-cased) input, used as a blind index for searchable/unique fields:
   * the same value always yields the same token, computable from the
   * plaintext alone, without revealing it. Returns `null` when encryption is
   * disabled — callers store/look up the plaintext value directly.
   */
  blindIndex(plaintext: string): string | null {
    if (!this.enabled) {
      return null;
    }
    // emailIndexKey presence is guaranteed by onModuleInit when enabled.
    return createHmac('sha256', this.emailIndexKey as Buffer)
      .update(BLIND_INDEX_LABEL)
      .update('\0')
      .update(plaintext.trim().toLowerCase(), 'utf8')
      .digest('base64url');
  }

  /**
   * Encrypts a user's email directly with KMS, bound to the owning user via
   * the encryption context. Returns the plaintext unchanged when encryption
   * is disabled. Stored form: `kms:v1:<base64url KMS ciphertext>` — the KMS
   * blob is self-describing (it embeds the KMS key id).
   */
  async encrypt(userId: number, email: string): Promise<string> {
    if (!this.enabled) {
      return email;
    }
    const ciphertext = await this.kmsService.encrypt({
      plaintext: Buffer.from(email, 'utf8'),
      encryptionContext: this.encryptionContext(userId),
    });
    return `${EMAIL_ENCRYPTION_PREFIX}:${EMAIL_ENCRYPTION_VERSION}:${ciphertext.toString('base64url')}`;
  }

  /**
   * Reverse of {@link encrypt}. With encryption enabled every stored value
   * must be `kms:` ciphertext — plaintext is an error (the backfill must
   * complete before enabling). With encryption disabled, plaintext is the
   * stored form and passes through, while ciphertext is still decrypted so
   * reads keep working after a rollback.
   */
  async decrypt(userId: number, value: string): Promise<string> {
    if (!this.isEncrypted(value)) {
      if (this.enabled) {
        throw new Error(
          `Encountered an unencrypted value for user ${userId} while field encryption is enabled`,
        );
      }
      return value;
    }
    const parts = value.split(':');
    if (
      parts.length !== 3 ||
      parts[1] !== EMAIL_ENCRYPTION_VERSION ||
      !parts[2]
    ) {
      throw new Error('Malformed ciphertext');
    }
    const plaintext = await this.kmsService.decrypt({
      ciphertext: Buffer.from(parts[2], 'base64url'),
      encryptionContext: this.encryptionContext(userId),
    });
    return plaintext.toString('utf8');
  }

  /**
   * Returns copies of the given users with their `email` values decrypted
   * (one KMS call per encrypted value) via {@link decrypt}, so with
   * encryption enabled a plaintext row throws rather than leaking through.
   * The input is left untouched; users without an email are returned as-is.
   * Every repository that hands a user row out of the database must route it
   * through here.
   */
  async decryptUserEmails<T extends { id: number; email: string | null }>(
    users: Array<T>,
  ): Promise<Array<T>> {
    // Each decrypt is an independent KMS round-trip; run them concurrently
    // rather than paying an O(N) sequential latency tax on list reads.
    return await Promise.all(
      users.map(async (user) =>
        user.email
          ? {
              ...user,
              // The plaintext is the value originally validated as an
              // EmailAddress before encryption.
              email: (await this.decrypt(user.id, user.email)) as T['email'],
            }
          : user,
      ),
    );
  }

  private encryptionContext(userId: number): Record<string, string> {
    return { userId: String(userId), field: EMAIL_FIELD };
  }
}
