// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { MockedObject } from '#/__tests__/mocks';
import type { MemberEncryptionService } from '#/modules/users/domain/members/member-encryption.service';

/**
 * A passthrough {@link MemberEncryptionService} double for repository tests.
 * It reproduces exactly how the real service behaves when field encryption
 * is disabled — the default everywhere outside production rollout: names and
 * aliases are stored and read back as plaintext and KMS is never touched.
 */
export function createMockMemberEncryptionService(): MockedObject<MemberEncryptionService> {
  return {
    encryptName: jest.fn((_spaceId: number, name: string) =>
      Promise.resolve(name),
    ),
    encryptAlias: jest.fn((_spaceId: number, alias: string) =>
      Promise.resolve(alias),
    ),
    decryptName: jest.fn((_spaceId: number, value: string) =>
      Promise.resolve(value),
    ),
    // Disabled-mode rows are plaintext, so batch decryption passes through.
    decryptMembers: jest.fn(
      (
        _spaceId: number,
        members: Array<{ name: string; alias: string | null }>,
      ) => Promise.resolve(members),
    ),
  } as MockedObject<MemberEncryptionService>;
}
