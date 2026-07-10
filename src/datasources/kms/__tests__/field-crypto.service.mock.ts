// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { FieldCryptoService } from '@/datasources/kms/field-crypto.service';

/**
 * A passthrough {@link FieldCryptoService} double reproducing disabled-mode
 * behavior — the default everywhere outside production rollout: values are
 * stored and read back as plaintext, blind indexes are null, and KMS is
 * never touched.
 */
export function createMockFieldCryptoService(): MockedObject<FieldCryptoService> {
  return {
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    encrypt: vi.fn((_field, _scope, value: string) => Promise.resolve(value)),
    decrypt: vi.fn((_field, _scope, value: string) => Promise.resolve(value)),
    blindIndex: vi.fn((_field, _value: string) => null),
    emailBlindIndex: vi.fn((_value: string) => null),
    onModuleInit: vi.fn(() => Promise.resolve()),
  } as unknown as MockedObject<FieldCryptoService>;
}
