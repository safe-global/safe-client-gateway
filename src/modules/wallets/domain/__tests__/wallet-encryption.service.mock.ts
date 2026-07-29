// SPDX-License-Identifier: FSL-1.1-MIT
import type { MockedObject } from 'vitest';
import type { WalletEncryptionService } from '@/modules/wallets/domain/wallet-encryption.service';

/**
 * A passthrough {@link WalletEncryptionService} double for repository tests.
 * It reproduces exactly how the real service behaves when field encryption
 * is disabled and no index key is configured — the default everywhere
 * outside production rollout: addresses are stored and read back as
 * plaintext, blind indexes are null, and KMS is never touched.
 */
export function createMockWalletEncryptionService(): MockedObject<WalletEncryptionService> {
  return {
    isEncrypted: vi.fn((value: string) => value.startsWith('kms:')),
    encryptAddress: vi.fn((_userId: number, address: string) =>
      Promise.resolve(address),
    ),
    addressIndex: vi.fn((_address: string) => null),
    decryptAddress: vi.fn((_userId: number, value: string) =>
      Promise.resolve(value),
    ),
    // Disabled-mode rows are plaintext, so batch decryption passes through.
    decryptWallets: vi.fn(
      (_userId: number, wallets: Array<{ address: string }>) =>
        Promise.resolve(wallets),
    ),
  } as MockedObject<WalletEncryptionService>;
}
