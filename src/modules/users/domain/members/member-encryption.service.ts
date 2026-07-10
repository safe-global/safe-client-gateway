// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { FieldCryptoService } from '@/datasources/kms/field-crypto.service';

@Injectable()
export class MemberEncryptionService {
  constructor(private readonly fieldCryptoService: FieldCryptoService) {}

  encryptName(spaceId: number, name: string): Promise<string> {
    return this.fieldCryptoService.encrypt('members.name', { spaceId }, name);
  }

  encryptAlias(spaceId: number, alias: string): Promise<string> {
    return this.fieldCryptoService.encrypt('members.alias', { spaceId }, alias);
  }

  decryptName(spaceId: number, value: string): Promise<string> {
    return this.fieldCryptoService.decrypt('members.name', { spaceId }, value);
  }

  async decryptMembers<T extends { name: string; alias: string | null }>(
    spaceId: number,
    members: Array<T>,
  ): Promise<Array<T>> {
    return Promise.all(
      members.map((member) =>
        Promise.all([
          this.fieldCryptoService.decrypt('members.name', { spaceId }, member.name),
          member.alias
            ? this.fieldCryptoService.decrypt('members.alias', { spaceId }, member.alias)
            : Promise.resolve(null),
        ]).then(([name, alias]) => ({
          ...member,
          name: name as T['name'],
          alias: alias as T['alias'],
        })),
      ),
    );
  }
}
