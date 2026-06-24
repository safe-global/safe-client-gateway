// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { EntityContext } from '@/datasources/encryption/envelope-key.service';
import type {
  CryptoField,
  PerEntityFieldCrypto,
} from '@/datasources/encryption/per-entity-field-crypto';

/**
 * A passthrough {@link PerEntityFieldCrypto} double for repository integration
 * tests. It reproduces exactly how the real service behaves when field
 * encryption is disabled — the default everywhere outside production rollout:
 * values are stored and read back as plaintext, no data key is minted and KMS is
 * never touched. This lets the repository integration suites exercise plain CRUD
 * without standing up KMS, mirroring the disabled path covered by the e2e suite.
 */
export function createMockPerEntityFieldCrypto(): MockedObject<PerEntityFieldCrypto> {
  return {
    encryptFields: vi.fn(
      (
        _context: EntityContext,
        encryptedDataKey: string | null | undefined,
        fields: Array<CryptoField>,
      ) =>
        Promise.resolve({
          encryptedDataKey: encryptedDataKey ?? null,
          values: fields.map((field) => field.value),
        }),
    ),
    decryptFields: vi.fn(
      (
        _context: EntityContext,
        _encryptedDataKey: string | null | undefined,
        fields: Array<CryptoField>,
      ) => Promise.resolve(fields.map((field) => field.value)),
    ),
    isEncrypted: vi.fn((value: string) => value.startsWith('enc:')),
    blindIndex: vi.fn((_value: string) => null),
  } as unknown as MockedObject<PerEntityFieldCrypto>;
}
