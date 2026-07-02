// SPDX-License-Identifier: FSL-1.1-MIT

import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FieldEncryptionService } from '@/datasources/encryption/field-encryption.service';
import type { IKmsApi } from '@/domain/interfaces/kms-api.interface';

const configurationService = {
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as unknown as MockedObject<IConfigurationService>;

const kmsApi = {
  generateDataKey: vi.fn(),
  decrypt: vi.fn(),
} as unknown as MockedObject<IKmsApi>;

// A deterministic 32-byte data key the mocked KMS "unwraps" to.
const DATA_KEY = Buffer.alloc(32, 7);
const DATA_KEY_2 = Buffer.alloc(32, 9);

async function buildTarget(args: {
  enabled: boolean;
  dataKeys?: Record<string, string>;
  indexKeyId?: string;
  unwrap?: (wrapped: Buffer) => Buffer;
}): Promise<FieldEncryptionService> {
  vi.resetAllMocks();

  const config: Record<string, unknown> = {
    'spaces.fieldEncryption.enabled': args.enabled,
  };
  configurationService.getOrThrow.mockImplementation((key: string) => {
    if (key in config) return config[key];
    throw new Error(`Unexpected config key: ${key}`);
  });
  configurationService.get.mockImplementation((key: string) => {
    if (key === 'spaces.fieldEncryption.dataKeys') {
      return args.dataKeys ? JSON.stringify(args.dataKeys) : undefined;
    }
    if (key === 'spaces.fieldEncryption.indexKeyId') return args.indexKeyId;
    return undefined;
  });

  const unwrap = args.unwrap ?? ((): Buffer => DATA_KEY);
  kmsApi.decrypt.mockImplementation((wrapped: Buffer) =>
    Promise.resolve(unwrap(wrapped)),
  );

  const target = new FieldEncryptionService(configurationService, kmsApi);
  await target.onModuleInit();
  return target;
}

// Default: encryption enabled with a single data key "1" as the blind-index key.
const enabledArgs = {
  enabled: true,
  indexKeyId: '1',
  dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
};

describe('FieldEncryptionService', () => {
  it('unwraps the configured data keys via KMS on init', async () => {
    await buildTarget(enabledArgs);

    expect(kmsApi.decrypt).toHaveBeenCalledWith(Buffer.from('wrapped-1'));
  });

  describe('blindIndex', () => {
    it('is deterministic and normalises case/whitespace', async () => {
      const target = await buildTarget(enabledArgs);

      expect(target.blindIndex(' Foo@Bar.com ')).toBe(
        target.blindIndex('foo@bar.com'),
      );
    });

    it('differs for different inputs and does not reveal the plaintext', async () => {
      const target = await buildTarget(enabledArgs);

      const index = target.blindIndex('alice@example.com');
      expect(index).not.toBe(target.blindIndex('bob@example.com'));
      expect(index).not.toContain('alice');
    });

    it('uses the index key (different index key => different token)', async () => {
      const withKey1 = await buildTarget(enabledArgs);
      const withKey2 = await buildTarget({
        enabled: true,
        indexKeyId: '2',
        dataKeys: {
          '1': Buffer.from('wrapped-1').toString('base64'),
          '2': Buffer.from('wrapped-2').toString('base64'),
        },
        unwrap: (wrapped) =>
          wrapped.equals(Buffer.from('wrapped-1')) ? DATA_KEY : DATA_KEY_2,
      });

      expect(withKey1.blindIndex('a@b.com')).not.toBe(
        withKey2.blindIndex('a@b.com'),
      );
    });

    it('still computes indexes when disabled but keys are configured (rollback safety)', async () => {
      const enabled = await buildTarget(enabledArgs);
      const disabled = await buildTarget({ ...enabledArgs, enabled: false });

      expect(disabled.blindIndex('a@b.com')).toBe(
        enabled.blindIndex('a@b.com'),
      );
    });
  });

  describe('configuration validation', () => {
    it('throws on init when a key id contains the ":" delimiter', async () => {
      await expect(
        buildTarget({
          enabled: true,
          indexKeyId: 'a:b',
          dataKeys: { 'a:b': Buffer.from('wrapped-1').toString('base64') },
        }),
      ).rejects.toThrow(/:/);
    });

    it('throws on init when enabled without a valid index key', async () => {
      await expect(
        buildTarget({
          enabled: true,
          // indexKeyId omitted
          dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
        }),
      ).rejects.toThrow(/indexKeyId/);
    });

    it('throws on init when the index key is not in the data-key map', async () => {
      await expect(
        buildTarget({
          enabled: true,
          indexKeyId: 'missing',
          dataKeys: { '1': Buffer.from('wrapped-1').toString('base64') },
        }),
      ).rejects.toThrow(/indexKeyId/);
    });
  });
});
