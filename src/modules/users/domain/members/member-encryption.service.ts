// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { KmsEncryptionService } from '@/datasources/kms/kms-encryption.service';

@Injectable()
export class MemberEncryptionService {
  constructor(private readonly kmsEncryption: KmsEncryptionService) {}

  private context(spaceId: number): Record<string, string> {
    return { spaceId: String(spaceId) };
  }

  encryptName(spaceId: number, name: string): Promise<string> {
    return this.kmsEncryption.encrypt(name, this.context(spaceId));
  }

  encryptAlias(spaceId: number, alias: string): Promise<string> {
    return this.kmsEncryption.encrypt(alias, this.context(spaceId));
  }

  decryptName(spaceId: number, value: string): Promise<string> {
    return this.kmsEncryption.decrypt(value, this.context(spaceId));
  }

  async decryptMembers<T extends { name: string; alias: string | null }>(
    spaceId: number,
    members: Array<T>,
  ): Promise<Array<T>> {
    return await Promise.all(
      members.map((member) =>
        Promise.all([
          this.kmsEncryption.decrypt(member.name, this.context(spaceId)),
          member.alias
            ? this.kmsEncryption.decrypt(member.alias, this.context(spaceId))
            : Promise.resolve(null),
        ]).then(([name, alias]) => ({
          ...member,
          name,
          alias,
        })),
      ),
    );
  }
}
