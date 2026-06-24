// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import { EnvelopeKeyService } from '@/datasources/encryption/envelope-key.service';
import type { IKmsApi } from '@/domain/interfaces/kms-api.interface';

/**
 * A fake KMS that binds the encryption context into the ciphertext and refuses
 * to decrypt under a mismatching context — mirroring real KMS behaviour.
 */
class FakeKms {
  encrypt(plaintext: Buffer, context: Record<string, string>): Promise<Buffer> {
    return Promise.resolve(
      Buffer.concat([Buffer.from(`${JSON.stringify(context)}|`), plaintext]),
    );
  }

  decrypt(
    ciphertext: Buffer,
    context?: Record<string, string>,
  ): Promise<Buffer> {
    const [head, ...rest] = ciphertext.toString('binary').split('|');
    if (head !== JSON.stringify(context ?? {})) {
      return Promise.reject(new Error('context mismatch'));
    }
    return Promise.resolve(Buffer.from(rest.join('|'), 'binary'));
  }
}

describe('EnvelopeKeyService', () => {
  const kms = new FakeKms() as unknown as MockedObject<IKmsApi>;
  const target = new EnvelopeKeyService(kms);

  it('createForEntity mints a 32-byte DEK wrapped as kdk:v1', async () => {
    const { dek, stored } = await target.createForEntity({ spaceId: '7' });

    expect(dek).toHaveLength(32);
    expect(stored.startsWith('kdk:v1:')).toBe(true);
  });

  it('resolve returns the same DEK under the matching context', async () => {
    const { dek, stored } = await target.createForEntity({ spaceId: '7' });

    const resolved = await target.resolve({ spaceId: '7' }, stored);

    expect(resolved.equals(dek)).toBe(true);
  });

  it('rejects when the context does not match the wrap', async () => {
    const { stored } = await target.createForEntity({ spaceId: '7' });

    await expect(target.resolve({ spaceId: '8' }, stored)).rejects.toThrow(
      'context mismatch',
    );
  });

  it('rejects an unsupported stored format', async () => {
    await expect(
      target.resolve({ spaceId: '7' }, 'edk:v1:not-kms'),
    ).rejects.toThrow('Unsupported encrypted_data_key format');
  });
});
