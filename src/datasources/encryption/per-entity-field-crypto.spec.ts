// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { EnvelopeKeyService } from '@/datasources/encryption/envelope-key.service';
import type { IFieldEncryptionService } from '@/datasources/encryption/field-encryption.service.interface';
import { PerEntityFieldCrypto } from '@/datasources/encryption/per-entity-field-crypto';
import type { IKmsApi } from '@/domain/interfaces/kms-api.interface';

const fieldEncryption = {
  blindIndex: (value: string): string => `idx(${value.trim().toLowerCase()})`,
} as unknown as IFieldEncryptionService;

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

function buildConfig(args: {
  enabled: boolean;
  allowLegacyPlaintext?: boolean;
}): IConfigurationService {
  return {
    getOrThrow: (key: string): unknown => {
      if (key === 'spaces.fieldEncryption.enabled') return args.enabled;
      if (key === 'spaces.fieldEncryption.allowLegacyPlaintext') {
        return args.allowLegacyPlaintext ?? true;
      }
      throw new Error(`Unexpected config key: ${key}`);
    },
    get: (): undefined => undefined,
  } as unknown as IConfigurationService;
}

describe('PerEntityFieldCrypto', () => {
  const kms = new FakeKms() as unknown as MockedObject<IKmsApi>;
  const envelopeKeys = new EnvelopeKeyService(kms);
  const target = new PerEntityFieldCrypto(
    envelopeKeys,
    buildConfig({ enabled: true }),
    fieldEncryption,
  );

  it('mints a key and encrypts fields with the entity label', async () => {
    const { encryptedDataKey, values } = await target.encryptFields(
      { userId: '3' },
      undefined,
      [{ value: 'a@b.com', aad: 'users.email' }],
    );

    expect(encryptedDataKey.startsWith('kdk:')).toBe(true);
    expect(values[0].startsWith('enc:v2:user-3:')).toBe(true);
    expect(values[0]).not.toContain('a@b.com');
  });

  it('round-trips a batch under one DEK (reusing an existing key)', async () => {
    const { encryptedDataKey, values } = await target.encryptFields(
      { userId: '3' },
      undefined,
      [
        { value: 'a@b.com', aad: 'users.email' },
        { value: 'Other Value', aad: 'other.field' },
      ],
    );

    const out = await target.decryptFields({ userId: '3' }, encryptedDataKey, [
      { value: values[0], aad: 'users.email' },
      { value: values[1], aad: 'other.field' },
    ]);

    expect(out).toEqual(['a@b.com', 'Other Value']);
  });

  it('encrypts subsequent fields under a provided key (no new mint)', async () => {
    const { encryptedDataKey } = await target.encryptFields(
      { userId: '9' },
      undefined,
      [{ value: 'first@example.com', aad: 'users.email' }],
    );

    const second = await target.encryptFields(
      { userId: '9' },
      encryptedDataKey,
      [{ value: 'second@example.com', aad: 'users.email' }],
    );

    expect(second.encryptedDataKey).toBe(encryptedDataKey);
    const [plain] = await target.decryptFields(
      { userId: '9' },
      encryptedDataKey,
      [{ value: second.values[0], aad: 'users.email' }],
    );
    expect(plain).toBe('second@example.com');
  });

  it('derives the label from the context key', async () => {
    const { values } = await target.encryptFields({ userId: '42' }, undefined, [
      { value: 'a@b.com', aad: 'users.email' },
    ]);

    expect(values[0].startsWith('enc:v2:user-42:')).toBe(true);
  });

  it('blindIndex returns a token when enabled', () => {
    expect(target.blindIndex(' A@b.com ')).toBe('idx(a@b.com)');
  });

  describe('when disabled', () => {
    const disabled = new PerEntityFieldCrypto(
      envelopeKeys,
      buildConfig({ enabled: false }),
      fieldEncryption,
    );

    it('blindIndex returns null', () => {
      expect(disabled.blindIndex('a@b.com')).toBeNull();
    });

    it('encryptFields is a plaintext passthrough with no data key', async () => {
      const result = await disabled.encryptFields({ userId: '1' }, undefined, [
        { value: 'plain@example.com', aad: 'users.email' },
      ]);

      expect(result.encryptedDataKey).toBeNull();
      expect(result.values).toEqual(['plain@example.com']);
    });

    it('decryptFields returns plaintext as-is', async () => {
      const out = await disabled.decryptFields({ userId: '1' }, null, [
        { value: 'plain@example.com', aad: 'users.email' },
      ]);

      expect(out).toEqual(['plain@example.com']);
    });
  });

  describe('legacy plaintext during rollout', () => {
    it('reads not-yet-backfilled plaintext through when allowed', async () => {
      const out = await target.decryptFields({ userId: '1' }, null, [
        { value: 'legacy@example.com', aad: 'users.email' },
      ]);

      expect(out).toEqual(['legacy@example.com']);
    });

    it('throws on legacy plaintext when not allowed', async () => {
      const strict = new PerEntityFieldCrypto(
        envelopeKeys,
        buildConfig({ enabled: true, allowLegacyPlaintext: false }),
        fieldEncryption,
      );

      await expect(
        strict.decryptFields({ userId: '1' }, null, [
          { value: 'legacy@example.com', aad: 'users.email' },
        ]),
      ).rejects.toThrow(/legacy plaintext/i);
    });

    it('decrypts encrypted values and passes plaintext through in a mixed batch', async () => {
      const { encryptedDataKey, values } = await target.encryptFields(
        { userId: '5' },
        undefined,
        [{ value: 'encrypted@example.com', aad: 'users.email' }],
      );

      const out = await target.decryptFields(
        { userId: '5' },
        encryptedDataKey,
        [
          { value: values[0], aad: 'users.email' },
          { value: 'still-plain@example.com', aad: 'users.email' },
        ],
      );

      expect(out).toEqual(['encrypted@example.com', 'still-plain@example.com']);
    });
  });
});
