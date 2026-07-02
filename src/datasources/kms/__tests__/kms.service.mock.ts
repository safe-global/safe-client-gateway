// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { KmsService } from '@/datasources/kms/kms.service';

/**
 * A passthrough {@link KmsService} double for repository integration tests.
 * It reproduces exactly how the real service behaves when field encryption is
 * disabled — the default everywhere outside production rollout: values are
 * stored and read back as plaintext and KMS is never touched. This lets the
 * repository integration suites exercise plain CRUD without standing up KMS,
 * mirroring the disabled path covered by the e2e suite.
 */
export function createMockKmsService(): MockedObject<KmsService> {
  return {
    encrypt: vi.fn((_userId: number, email: string) => Promise.resolve(email)),
    decrypt: vi.fn((_userId: number, value: string) => Promise.resolve(value)),
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    blindIndex: vi.fn((_value: string) => null),
  } as unknown as MockedObject<KmsService>;
}
