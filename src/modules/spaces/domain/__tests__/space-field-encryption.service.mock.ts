// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { SpaceFieldEncryptionService } from '@/modules/spaces/domain/space-field-encryption.service';

/**
 * A passthrough {@link SpaceFieldEncryptionService} double reproducing
 * exactly how the real service behaves when field encryption is disabled —
 * the default everywhere outside production rollout: values pass through
 * unchanged, blind indexes are null (callers store/look up plaintext), and
 * KMS is never touched. Mirrors createMockEmailEncryptionService.
 */
export function createMockSpaceFieldEncryptionService(): MockedObject<SpaceFieldEncryptionService> {
  return {
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    encryptSpaceName: vi.fn((_spaceId: number, name: string) =>
      Promise.resolve(name),
    ),
    decryptSpaceName: vi.fn((_spaceId: number, value: string) =>
      Promise.resolve(value),
    ),
    decryptSpaces: vi.fn((spaces: Array<{ id: number; name: string }>) =>
      Promise.resolve(spaces),
    ),
    encryptSafeAddress: vi.fn((_spaceId: number, address: string) =>
      Promise.resolve(address),
    ),
    safeAddressIndex: vi.fn((_address: string) => null),
    decryptSpaceSafes: vi.fn(
      (_spaceId: number, safes: Array<{ address: string }>) =>
        Promise.resolve(safes),
    ),
    encryptAddressBookItem: vi.fn(
      (_spaceId: number, entry: { address: string; name: string }) =>
        Promise.resolve({ ...entry, addressIndex: null }),
    ),
    itemAddressIndex: vi.fn((_address: string) => null),
    decryptAddressBookItems: vi.fn(
      (_spaceId: number, items: Array<{ address: string; name: string }>) =>
        Promise.resolve(items),
    ),
    encryptAddressBookRequest: vi.fn(
      (_spaceId: number, entry: { address: string; name: string }) =>
        Promise.resolve({ ...entry, addressIndex: null }),
    ),
    requestAddressIndex: vi.fn((_address: string) => null),
    decryptAddressBookRequests: vi.fn(
      (_spaceId: number, requests: Array<{ address: string; name: string }>) =>
        Promise.resolve(requests),
    ),
    decryptAuditPayload: vi.fn(
      (
        _spaceId: number,
        _eventType: string,
        payload: Record<string, unknown>,
      ) => Promise.resolve(payload),
    ),
  } as unknown as MockedObject<SpaceFieldEncryptionService>;
}
