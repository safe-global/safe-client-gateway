// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

@Injectable()
export class WalletEncryptionService {
  constructor(private readonly kmsEncryption: KmsEncryptionService) {}

  isEncrypted(value: string): boolean {
    return this.kmsEncryption.isEncrypted(value);
  }

  encryptAddress(userId: number, address: string): Promise<string> {
    return this.kmsEncryption.encrypt(address, { userId: String(userId) });
  }

  addressIndex(address: string): string | null {
    return this.kmsEncryption.blindIndex(address);
  }

  decryptAddress(userId: number, value: string): Promise<string> {
    return this.kmsEncryption.decrypt(value, { userId: String(userId) });
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
