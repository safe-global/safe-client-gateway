import { IConfigurationService } from '@/config/configuration.service.interface';
import { IBlocklistService } from '@/config/entities/blocklist.interface';
import { decryptData } from '@/domain/common/utils/encryption';
import { Inject, Injectable } from '@nestjs/common';
import { getAddress, type Address } from 'viem';

@Injectable()
export class BlocklistService implements IBlocklistService {
  private cachedBlocklist: Array<Address> | null = null;

  constructor(
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {}

  /**
   * Retrieves the blocklist of addresses from encrypted configuration data.
   *
   * This method decrypts the blocklist data using the configured encryption key and salt,
   * then normalizes all addresses using viem's getAddress function to ensure proper checksumming.
   * The result is cached to avoid repeated decryption operations.
   *
   * @returns Array of normalized blockchain addresses that are blocked
   *
   * @throws Error if decryption fails or required configuration is missing
   */
  getBlocklist(): Array<Address> {
    const isEnabled = this.configurationService.getOrThrow<boolean>(
      'blockchain.blocklistEnabled',
    );

    if (!isEnabled) {
      return [];
    }

    if (this.cachedBlocklist !== null) {
      return this.cachedBlocklist;
    }

    const secretData = this.configurationService.getOrThrow<string>(
      'blockchain.blocklistSecretData',
    );
    const secretKey = this.configurationService.getOrThrow<string>(
      'blockchain.blocklistSecretKey',
    );
    const secretSalt = this.configurationService.getOrThrow<string>(
      'blockchain.blocklistSecretSalt',
    );

    const decryptedAddresses = decryptData<Array<string>>(
      secretData,
      secretKey,
      secretSalt,
    );

    this.cachedBlocklist = decryptedAddresses.map((address) =>
      getAddress(address),
    );

    return this.cachedBlocklist;
  }

  /**
   * Clears the cached blocklist, forcing a fresh decryption on next access.
   * Useful for testing or when configuration changes.
   */
  clearCache(): void {
    this.cachedBlocklist = null;
  }
}
