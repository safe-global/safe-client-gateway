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

  it('mints a key and encrypts fields with the space label', async () => {
    const { encryptedDataKey, values } = await target.encryptFields(
      { spaceId: '3' },
      undefined,
      [{ value: 'My Space', aad: 'spaces.name' }],
    );

    expect(encryptedDataKey.startsWith('kdk:')).toBe(true);
    expect(values[0].startsWith('enc:v2:space-3:')).toBe(true);
    expect(values[0]).not.toContain('My Space');
  });

  it('round-trips a batch under one DEK (reusing an existing key)', async () => {
    const { encryptedDataKey, values } = await target.encryptFields(
      { spaceId: '3' },
      undefined,
      [
        { value: 'My Space', aad: 'spaces.name' },
        { value: 'Alias', aad: 'members.alias' },
      ],
    );

    const out = await target.decryptFields({ spaceId: '3' }, encryptedDataKey, [
      { value: values[0], aad: 'spaces.name' },
      { value: values[1], aad: 'members.alias' },
    ]);

    expect(out).toEqual(['My Space', 'Alias']);
  });

  it('encrypts subsequent fields under a provided key (no new mint)', async () => {
    const { encryptedDataKey } = await target.encryptFields(
      { spaceId: '9' },
      undefined,
      [{ value: 'first', aad: 'spaces.name' }],
    );

    const second = await target.encryptFields(
      { spaceId: '9' },
      encryptedDataKey,
      [{ value: 'member', aad: 'members.name' }],
    );

    expect(second.encryptedDataKey).toBe(encryptedDataKey);
    const [plain] = await target.decryptFields(
      { spaceId: '9' },
      encryptedDataKey,
      [{ value: second.values[0], aad: 'members.name' }],
    );
    expect(plain).toBe('member');
  });

  it('labels users with the user- prefix', async () => {
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
      const result = await disabled.encryptFields({ spaceId: '1' }, undefined, [
        { value: 'plain', aad: 'spaces.name' },
      ]);

      expect(result.encryptedDataKey).toBeNull();
      expect(result.values).toEqual(['plain']);
    });

    it('decryptFields returns plaintext as-is', async () => {
      const out = await disabled.decryptFields({ spaceId: '1' }, null, [
        { value: 'plain', aad: 'spaces.name' },
      ]);

      expect(out).toEqual(['plain']);
    });
  });

  describe('legacy plaintext during rollout', () => {
    it('reads not-yet-backfilled plaintext through when allowed', async () => {
      const out = await target.decryptFields({ spaceId: '1' }, null, [
        { value: 'Legacy Name', aad: 'spaces.name' },
      ]);

      expect(out).toEqual(['Legacy Name']);
    });

    it('throws on legacy plaintext when not allowed', async () => {
      const strict = new PerEntityFieldCrypto(
        envelopeKeys,
        buildConfig({ enabled: true, allowLegacyPlaintext: false }),
        fieldEncryption,
      );

      await expect(
        strict.decryptFields({ spaceId: '1' }, null, [
          { value: 'Legacy Name', aad: 'spaces.name' },
        ]),
      ).rejects.toThrow(/legacy plaintext/i);
    });

    it('decrypts encrypted values and passes plaintext through in a mixed batch', async () => {
      const { encryptedDataKey, values } = await target.encryptFields(
        { spaceId: '5' },
        undefined,
        [{ value: 'Encrypted', aad: 'spaces.name' }],
      );

      const out = await target.decryptFields(
        { spaceId: '5' },
        encryptedDataKey,
        [
          { value: values[0], aad: 'spaces.name' },
          { value: 'Still Plain', aad: 'members.name' },
        ],
      );

      expect(out).toEqual(['Encrypted', 'Still Plain']);
    });
  });
});
