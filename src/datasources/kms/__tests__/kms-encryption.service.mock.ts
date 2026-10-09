// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { MockedObject } from '#/__tests__/mocks';
import type { KmsEncryptionService } from '#/datasources/kms/kms-encryption.service';

/**
 * A passthrough {@link KmsEncryptionService} double reproducing disabled-mode
 * behavior — the default everywhere outside production rollout: values are
 * stored and read back as plaintext, blind indexes are null, and KMS is
 * never touched.
 */
export function createMockKmsEncryptionService(): MockedObject<KmsEncryptionService> {
  return {
    isEncrypted: jest.fn((value: string) => value.startsWith('kms:')),
    encrypt: jest.fn((value: string, _ctx: Record<string, string>) =>
      Promise.resolve(value),
    ),
    decrypt: jest.fn((value: string, _ctx: Record<string, string>) =>
      Promise.resolve(value),
    ),
    blindIndex: jest.fn((_value: string) => null),
    onModuleInit: jest.fn(() => Promise.resolve()),
  } as MockedObject<KmsEncryptionService>;
}
