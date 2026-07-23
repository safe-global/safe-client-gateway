// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

/**
 * A passthrough {@link KmsEncryptionService} double reproducing disabled-mode
 * behavior — the default everywhere outside production rollout: values are
 * stored and read back as plaintext, blind indexes are null, and KMS is
 * never touched.
 */
export function createMockKmsEncryptionService(): MockedObject<KmsEncryptionService> {
  return {
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    encrypt: vi.fn((value: string, _ctx: Record<string, string>) =>
      Promise.resolve(value),
    ),
    decrypt: vi.fn((value: string, _ctx: Record<string, string>) =>
      Promise.resolve(value),
    ),
    blindIndex: vi.fn((_value: string) => null),
    onModuleInit: vi.fn(() => Promise.resolve()),
  } as MockedObject<KmsEncryptionService>;
}
