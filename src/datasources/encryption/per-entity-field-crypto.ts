// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  formatCiphertext,
  parseCiphertext,
} from '@/datasources/encryption/aes-gcm';
import {
  type EntityContext,
  EnvelopeKeyService,
} from '@/datasources/encryption/envelope-key.service';
import { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';

const PREFIX = 'enc';
const VERSION = 'v2';

/** A field to encrypt/decrypt: its value and the AAD binding it to its column. */
export interface CryptoField {
  value: string;
  aad: string;
}

/**
 * Encrypts and decrypts a batch of fields belonging to a single entity, using
 * that entity's per-entity DEK. The DEK is resolved from KMS exactly once per
 * call (mint on first write, otherwise unwrap the provided key) and discarded
 * when the call returns — it is never cached.
 *
 * Field ciphertext is `enc:v2:<entityLabel>:<iv>:<tag>:<ct>`, where the label
 * (`space-7`, `user-42`) records the owning entity for self-description; the DEK
 * is resolved from the caller-supplied {@link EntityContext}.
 *
 * Encryption is gated centrally here so repositories can call it
 * unconditionally:
 * - disabled → plaintext passthrough (no KMS), as the column transformers did;
 * - enabled with `allowLegacyPlaintext` → not-yet-backfilled plaintext reads
 *   through untouched, encrypted reads are decrypted (mixed rows during rollout).
 */
@Injectable()
export class PerEntityFieldCrypto {
  private readonly enabled: boolean;
  private readonly allowLegacyPlaintext: boolean;

  constructor(
    private readonly envelopeKeys: EnvelopeKeyService,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(IFieldEncryptionService)
    private readonly fieldEncryptionService: IFieldEncryptionService,
  ) {
    this.enabled = configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.enabled',
    );
    this.allowLegacyPlaintext = configurationService.getOrThrow<boolean>(
      'spaces.fieldEncryption.allowLegacyPlaintext',
    );
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(`${PREFIX}:`);
  }

  /**
   * Deterministic blind index for a searchable/unique field (e.g. email), or
   * `null` when encryption is disabled — in which case callers store/look up the
   * plaintext value directly. Keyed by the app-wide index key.
   */
  blindIndex(value: string): string | null {
    return this.enabled ? this.fieldEncryptionService.blindIndex(value) : null;
  }

  /**
   * `space-7` / `user-42` etc. Derived from the single-entry context so the
   * label identifies the owning entity.
   */
  private label(context: EntityContext): string {
    const [key, value] = Object.entries(context)[0];
    return `${key.replace(/Id$/, '')}-${value}`;
  }

  /**
   * Encrypts `fields` under the entity's DEK. When `encryptedDataKey` is
   * undefined/null a new DEK is minted and returned; otherwise the existing key
   * is reused. Returns the stored key (null when encryption is disabled) and the
   * resulting values (plaintext, unchanged, when disabled).
   */
  async encryptFields(
    context: EntityContext,
    encryptedDataKey: string | null | undefined,
    fields: Array<CryptoField>,
  ): Promise<{ encryptedDataKey: string | null; values: Array<string> }> {
    if (!this.enabled) {
      return {
        encryptedDataKey: encryptedDataKey ?? null,
        values: fields.map((field) => field.value),
      };
    }

    let dek: Buffer;
    let storedKey: string;
    if (encryptedDataKey) {
      storedKey = encryptedDataKey;
      dek = await this.envelopeKeys.resolve(context, encryptedDataKey);
    } else {
      ({ dek, stored: storedKey } =
        await this.envelopeKeys.createForEntity(context));
    }

    const label = this.label(context);
    const values = fields.map((field) =>
      formatCiphertext(
        PREFIX,
        VERSION,
        label,
        aesGcmEncrypt(dek, Buffer.from(field.value, 'utf8'), field.aad),
      ),
    );
    return { encryptedDataKey: storedKey, values };
  }

  /**
   * Decrypts `fields` previously produced by {@link encryptFields}. Values not in
   * the `enc:` format are treated as legacy plaintext and returned as-is while
   * `allowLegacyPlaintext` is set (rollout); otherwise this throws.
   */
  async decryptFields(
    context: EntityContext,
    encryptedDataKey: string | null | undefined,
    fields: Array<CryptoField>,
  ): Promise<Array<string>> {
    const anyEncrypted = fields.some((field) => this.isEncrypted(field.value));
    if (!anyEncrypted) {
      this.assertLegacyAllowed();
      return fields.map((field) => field.value);
    }
    if (!encryptedDataKey) {
      throw new Error(
        'Encountered encrypted field but the entity has no data key to decrypt it',
      );
    }

    const dek = await this.envelopeKeys.resolve(context, encryptedDataKey);
    return fields.map((field) => {
      if (!this.isEncrypted(field.value)) {
        this.assertLegacyAllowed();
        return field.value;
      }
      return aesGcmDecrypt(
        dek,
        parseCiphertext(field.value),
        field.aad,
      ).toString('utf8');
    });
  }

  private assertLegacyAllowed(): void {
    if (!this.allowLegacyPlaintext) {
      throw new Error(
        'Encountered unencrypted (legacy plaintext) value but legacy plaintext reads are disabled',
      );
    }
  }
}
