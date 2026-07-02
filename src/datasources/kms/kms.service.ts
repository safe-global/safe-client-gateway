// SPDX-License-Identifier: FSL-1.1-MIT
import { createHmac } from 'node:crypto';
import {
  DecryptCommand,
  EncryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { fromTokenFile } from '@aws-sdk/credential-provider-web-identity';
import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';

/**
 * A symmetric data key produced by a KMS `GenerateDataKey` operation.
 *
 * `plaintext` is the raw key material; it must NEVER be persisted or logged.
 * `encrypted` is the KMS-wrapped form that is safe to store in configuration.
 */
export interface KmsDataKey {
  plaintext: Buffer;
  encrypted: Buffer;
}

const PREFIX = 'kms';
const VERSION = 'v1';

/*
 * On-disk contract — immutable once ciphertext or indexes exist:
 * - the `kms:v1:` prefix,
 * - the encryption-context keys/values (`userId`, `field`, 'users.email'),
 * - the blind-index HMAC construction (domain label, `\0` separator,
 *   trim+lowercase normalisation, base64url).
 * Changing any of these makes stored values undecryptable or unmatchable.
 */
const EMAIL_FIELD = 'users.email';
const BLIND_INDEX_LABEL = 'fieldenc-blind-index-v1';
const INDEX_KEY_LENGTH = 32;

/**
 * The single KMS-backed crypto service for user-email field encryption.
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
 * - disabled → plaintext passthrough (no KMS);
 * - enabled with `allowLegacyPlaintext` → not-yet-backfilled plaintext reads
 *   through untouched, encrypted reads are decrypted (mixed rows during
 *   rollout).
 */
@Injectable()
export class KmsService implements OnModuleInit {
  private readonly enabled: boolean;
  private readonly allowLegacyPlaintext: boolean;
  private readonly wrappedIndexKey: string | undefined;
  /** Unwrapped blind-index key; populated on init whenever configured. */
  private indexKey: Buffer | undefined;
  // Built lazily: when field encryption is disabled (the default) this service
  // is still instantiated by the DI container, but it must not require any KMS
  // configuration until a KMS call is actually made.
  private client: KMSClient | undefined;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.enabled = this.configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.enabled',
    );
    this.allowLegacyPlaintext = this.configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.allowLegacyPlaintext',
    );
    this.wrappedIndexKey = this.configurationService.get<string>(
      'spaces.fieldEncryption.indexKey',
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
      const plaintext = await this.kmsDecrypt(
        Buffer.from(this.wrappedIndexKey, 'base64'),
      );
      if (plaintext.length !== INDEX_KEY_LENGTH) {
        throw new Error(
          `The blind-index key must be ${INDEX_KEY_LENGTH} bytes, got ${plaintext.length}`,
        );
      }
      this.indexKey = plaintext;
    }
    if (this.enabled && !this.indexKey) {
      throw new Error(
        'spaces.fieldEncryption.indexKey is required when field encryption is enabled',
      );
    }
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${PREFIX}:`);
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
    // indexKey presence is guaranteed by onModuleInit when enabled.
    return createHmac('sha256', this.indexKey as Buffer)
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
    const response = await this.getClient().send(
      new EncryptCommand({
        KeyId: this.getKeyId(),
        Plaintext: Buffer.from(email, 'utf8'),
        EncryptionContext: this.encryptionContext(userId),
      }),
    );
    if (!response.CiphertextBlob) {
      throw new Error('KMS did not return ciphertext');
    }
    const blob = Buffer.from(response.CiphertextBlob).toString('base64url');
    return `${PREFIX}:${VERSION}:${blob}`;
  }

  /**
   * Reverse of {@link encrypt}. Values not in the `kms:` format are legacy
   * plaintext: returned as-is while `allowLegacyPlaintext` (rollout), thrown
   * otherwise. Ciphertext is decrypted regardless of `enabled` so reads keep
   * working after a rollback.
   */
  async decrypt(userId: number, value: string): Promise<string> {
    if (!this.isEncrypted(value)) {
      if (!this.allowLegacyPlaintext) {
        throw new Error(
          'Encountered unencrypted (legacy plaintext) value but legacy plaintext reads are disabled',
        );
      }
      return value;
    }
    const parts = value.split(':');
    if (parts.length !== 3 || parts[1] !== VERSION || !parts[2]) {
      throw new Error('Malformed ciphertext');
    }
    const plaintext = await this.kmsDecrypt(
      Buffer.from(parts[2], 'base64url'),
      this.encryptionContext(userId),
    );
    return plaintext.toString('utf8');
  }

  /**
   * Generates a new 256-bit symmetric key wrapped by the configured KMS key.
   * Used by scripts/generate-field-encryption-index-key to mint the
   * blind-index key: the `encrypted` blob is what gets stored in config.
   */
  async generateDataKey(): Promise<KmsDataKey> {
    const response = await this.getClient().send(
      new GenerateDataKeyCommand({
        KeyId: this.getKeyId(),
        KeySpec: 'AES_256',
      }),
    );
    if (!(response.Plaintext && response.CiphertextBlob)) {
      throw new Error('KMS did not return data key material');
    }
    return {
      plaintext: Buffer.from(response.Plaintext),
      encrypted: Buffer.from(response.CiphertextBlob),
    };
  }

  private encryptionContext(userId: number): Record<string, string> {
    return { userId: String(userId), field: EMAIL_FIELD };
  }

  private async kmsDecrypt(
    encrypted: Buffer,
    encryptionContext?: Record<string, string>,
  ): Promise<Buffer> {
    const response = await this.getClient().send(
      new DecryptCommand({
        CiphertextBlob: new Uint8Array(encrypted),
        KeyId: this.getKeyId(),
        ...(encryptionContext && { EncryptionContext: encryptionContext }),
      }),
    );
    if (!response.Plaintext) {
      throw new Error('KMS did not return plaintext');
    }
    return Buffer.from(response.Plaintext);
  }

  private getKeyId(): string {
    return this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.keyId',
    );
  }

  private getClient(): KMSClient {
    if (this.client) {
      return this.client;
    }
    const region = this.configurationService.getOrThrow<string>(
      'spaces.fieldEncryption.kms.region',
    );

    // In EKS the pod credentials are provided via IRSA (web identity token),
    // mirroring the SES datasource; otherwise fall back to static credentials.
    const webIdentityTokenFile = this.configurationService.get<string>(
      'spaces.fieldEncryption.kms.webIdentityTokenFile',
    );
    const credentials = webIdentityTokenFile
      ? fromTokenFile()
      : {
          accessKeyId: this.configurationService.getOrThrow<string>(
            'spaces.fieldEncryption.kms.accessKeyId',
          ),
          secretAccessKey: this.configurationService.getOrThrow<string>(
            'spaces.fieldEncryption.kms.secretAccessKey',
          ),
        };

    this.client = new KMSClient({ region, credentials });
    return this.client;
  }
}
