// SPDX-License-Identifier: FSL-1.1-MIT
import { type Address, getAddress } from 'viem';
import configuration from '@/config/entities/configuration';
import { decryptData } from '@/domain/common/utils/encryption';

let cachedBlocklist: Array<Address> | null = null;

/**
 * Retrieves the blocklist of addresses from encrypted configuration data.
 *
 * @deprecated Use BlocklistService with dependency injection instead
 * This function is kept for backward compatibility and testing purposes.
 *
 * This function decrypts the blocklist data using the configured encryption key and salt,
 * then normalizes all addresses using viem's getAddress function to ensure proper checksumming.
 * The result is cached to avoid repeated decryption operations.
 *
 * @returns Array of normalized blockchain addresses that are blocked
 *
 * @throws Error if decryption fails or required configuration is missing
 */
export function getBlocklist(): Array<Address> {
  const config = configuration();

  if (!config.blockchain.blocklistEnabled) {
    return [];
  }

  if (cachedBlocklist !== null) {
    return cachedBlocklist;
  }

  const { blocklistSecretData, blocklistSecretKey, blocklistSecretSalt } =
    config.blockchain;

  if (
    blocklistSecretData == null ||
    blocklistSecretKey == null ||
    blocklistSecretSalt == null
  ) {
    throw new Error('Blocklist is enabled but secret configuration is missing');
  }

  const decryptedAddresses = decryptData<Array<string>>(
    blocklistSecretData,
    blocklistSecretKey,
    blocklistSecretSalt,
  );

  cachedBlocklist = decryptedAddresses.map((address) => getAddress(address));

  return cachedBlocklist;
}
