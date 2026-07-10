// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';

@Injectable()
export class WalletEncryptionService {
  constructor(private readonly fieldCryptoService: FieldCryptoService) {}

  isEncrypted(value: string): boolean {
    return this.fieldCryptoService.isEncrypted(value);
  }

  encryptAddress(userId: number, address: string): Promise<string> {
    return this.fieldCryptoService.encrypt(
      'wallets.address',
      { userId },
      address,
    );
  }

  addressIndex(address: string): string | null {
    return this.fieldCryptoService.blindIndex('wallets.address', address);
  }

  decryptAddress(userId: number, value: string): Promise<string> {
    return this.fieldCryptoService.decrypt(
      'wallets.address',
      { userId },
      value,
    );
  }

  async decryptWallets<T extends { address: string }>(
    userId: number,
    wallets: Array<T>,
  ): Promise<Array<T>> {
    return Promise.all(
      wallets.map((wallet) =>
        wallet.address
          ? this.decryptAddress(userId, wallet.address).then((address) => ({
              ...wallet,
              address: address as T['address'],
            }))
          : Promise.resolve(wallet),
      ),
    );
  }
}
