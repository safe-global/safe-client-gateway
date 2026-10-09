// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { MockedObject } from '#/__tests__/mocks';
import type { SpaceEncryptionService } from '#/modules/spaces/domain/space-encryption.service';

/**
 * A passthrough {@link SpaceEncryptionService} double reproducing
 * exactly how the real service behaves when field encryption is disabled —
 * the default everywhere outside production rollout: values pass through
 * unchanged, blind indexes are null (callers store/look up plaintext), and
 * KMS is never touched. Mirrors createMockUserEncryptionService.
 */
export function createMockSpaceEncryptionService(): MockedObject<SpaceEncryptionService> {
  return {
    isEncrypted: jest.fn((value: string) => value.startsWith('kms:')),
    encryptSpaceName: jest.fn((_spaceId: number, name: string) =>
      Promise.resolve(name),
    ),
    decryptSpaceName: jest.fn((_spaceId: number, value: string) =>
      Promise.resolve(value),
    ),
    decryptSpaces: jest.fn((spaces: Array<{ id: number; name: string }>) =>
      Promise.resolve(spaces),
    ),
    encryptSafeAddress: jest.fn((_spaceId: number, address: string) =>
      Promise.resolve(address),
    ),
    safeAddressIndex: jest.fn((_address: string) => null),
    decryptSpaceSafes: jest.fn(
      (_spaceId: number, safes: Array<{ address: string }>) =>
        Promise.resolve(safes),
    ),
    encryptAddressBookItem: jest.fn(
      (_spaceId: number, entry: { address: string; name: string }) =>
        Promise.resolve({ ...entry, addressIndex: null }),
    ),
    itemAddressIndex: jest.fn((_address: string) => null),
    decryptAddressBookItems: jest.fn(
      (_spaceId: number, items: Array<{ address: string; name: string }>) =>
        Promise.resolve(items),
    ),
    encryptAddressBookRequest: jest.fn(
      (_spaceId: number, entry: { address: string; name: string }) =>
        Promise.resolve({ ...entry, addressIndex: null }),
    ),
    requestAddressIndex: jest.fn((_address: string) => null),
    decryptAddressBookRequests: jest.fn(
      (_spaceId: number, requests: Array<{ address: string; name: string }>) =>
        Promise.resolve(requests),
    ),
    encryptAuditPayload: jest.fn((_spaceId: number, payload: unknown) =>
      Promise.resolve(JSON.stringify(payload)),
    ),
    decryptAuditPayload: jest.fn((_spaceId: number, payload: string) =>
      Promise.resolve(JSON.parse(payload)),
    ),
  } as MockedObject<SpaceEncryptionService>;
}
