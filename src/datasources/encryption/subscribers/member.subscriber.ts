// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import type { EncryptedFieldConfig } from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';
import { EncryptedEntitySubscriber } from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';

@Injectable()
export class MemberSubscriber extends EncryptedEntitySubscriber<Member> {
  protected readonly fieldConfigs: Array<EncryptedFieldConfig> = [
    { field: 'name', hashField: 'nameHash' },
  ];

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  listenTo(): typeof Member {
    return Member;
  }
}
