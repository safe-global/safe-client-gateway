// SPDX-License-Identifier: FSL-1.1-MIT
import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { KEY_LENGTH } from '@/datasources/encryption/aes-gcm';
import { IKmsApi } from '@/domain/interfaces/kms-api.interface';

/** Key/value pairs bound into a per-entity data key via the KMS encryption
 *  context — e.g. `{ spaceId: '7' }` or `{ userId: '42' }`. */
export type EntityContext = Record<string, string>;

const PREFIX = 'kdk';
const VERSION = 'v1';

/**
 * Mints and resolves per-entity data keys (DEKs) using envelope encryption.
 *
 * A DEK is random 256-bit key material, wrapped by KMS with an
 * {@link EntityContext} that binds it to its owning entity. The wrapped form
 * (`kdk:v1:<base64>`) is what gets stored in the entity's `encrypted_data_key`
 * column; the KMS ciphertext is safe to store at rest. The plaintext DEK is
 * returned only transiently and is NEVER cached — callers use it within a single
 * operation and discard it.
 *
 * (The optional extra local re-wrap of the stored blob is deferred; see the
 * design spec. Today the column holds the KMS ciphertext directly.)
 */
@Injectable()
export class EnvelopeKeyService {
  constructor(@Inject(IKmsApi) private readonly kmsApi: IKmsApi) {}

  /**
   * Mints a new per-entity DEK. Returns the plaintext `dek` for immediate use
   * within the current operation and `stored`, the KMS-wrapped form for the
   * `encrypted_data_key` column.
   */
  async createForEntity(
    context: EntityContext,
  ): Promise<{ dek: Buffer; stored: string }> {
    const dek = randomBytes(KEY_LENGTH);
    const kmsBlob = await this.kmsApi.encrypt(dek, context);
    return {
      dek,
      stored: `${PREFIX}:${VERSION}:${kmsBlob.toString('base64')}`,
    };
  }

  /** Unwraps a stored value back to the plaintext DEK via KMS. Never cached. */
  async resolve(context: EntityContext, storedValue: string): Promise<Buffer> {
    const [prefix, version, blob] = storedValue.split(':');
    if (prefix !== PREFIX || version !== VERSION) {
      throw new Error('Unsupported encrypted_data_key format');
    }
    return await this.kmsApi.decrypt(Buffer.from(blob, 'base64'), context);
  }
}
