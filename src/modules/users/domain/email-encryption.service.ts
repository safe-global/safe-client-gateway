// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

@Injectable()
export class EmailEncryptionService {
  constructor(private readonly kmsEncryption: KmsEncryptionService) {}

  isEncrypted(value: string): boolean {
    return this.kmsEncryption.isEncrypted(value);
  }

  blindIndex(plaintext: string): string | null {
    return this.kmsEncryption.blindIndex(plaintext);
  }

  encrypt(userId: number, email: string): Promise<string> {
    return this.kmsEncryption.encrypt(email, { userId: String(userId) });
  }

  decrypt(userId: number, value: string): Promise<string> {
    return this.kmsEncryption.decrypt(value, { userId: String(userId) });
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
