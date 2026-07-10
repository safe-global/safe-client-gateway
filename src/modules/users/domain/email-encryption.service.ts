// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';

@Injectable()
export class EmailEncryptionService {
  constructor(private readonly fieldCrypto: FieldCryptoService) {}

  isEncrypted(value: string): boolean {
    return this.fieldCrypto.isEncrypted(value);
  }

  blindIndex(plaintext: string): string | null {
    return this.fieldCrypto.emailBlindIndex(plaintext);
  }

  encrypt(userId: number, email: string): Promise<string> {
    return this.fieldCrypto.encrypt('users.email', { userId }, email);
  }

  decrypt(userId: number, value: string): Promise<string> {
    return this.fieldCrypto.decrypt('users.email', { userId }, value);
  }

  async decryptUserEmails<T extends { id: number; email: string | null }>(
    users: Array<T>,
  ): Promise<Array<T>> {
    return Promise.all(
      users.map((user) =>
        user.email
          ? this.decrypt(user.id, user.email).then((email) => ({
              ...user,
              email: email as T['email'],
            }))
          : Promise.resolve(user),
      ),
    );
  }
}
