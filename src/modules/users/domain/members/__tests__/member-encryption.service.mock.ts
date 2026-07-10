// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { MemberEncryptionService } from '@/modules/users/domain/members/member-encryption.service';

/**
 * A passthrough {@link MemberEncryptionService} double for repository tests.
 * It reproduces exactly how the real service behaves when field encryption
 * is disabled — the default everywhere outside production rollout: names and
 * aliases are stored and read back as plaintext and KMS is never touched.
 */
export function createMockMemberEncryptionService(): MockedObject<MemberEncryptionService> {
  return {
    encryptName: vi.fn((_spaceId: number, name: string) =>
      Promise.resolve(name),
    ),
    encryptAlias: vi.fn((_spaceId: number, alias: string) =>
      Promise.resolve(alias),
    ),
    decryptName: vi.fn((_spaceId: number, value: string) =>
      Promise.resolve(value),
    ),
    // Disabled-mode rows are plaintext, so batch decryption passes through.
    decryptMembers: vi.fn(
      (
        _spaceId: number,
        members: Array<{ name: string; alias: string | null }>,
      ) => Promise.resolve(members),
    ),
  } as MockedObject<MemberEncryptionService>;
}
