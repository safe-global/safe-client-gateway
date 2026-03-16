// SPDX-License-Identifier: FSL-1.1-MIT
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import type { EncryptedFieldConfig } from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';
import { EncryptedEntitySubscriber } from '@/datasources/encryption/subscribers/encrypted-entity.subscriber.base';

@Injectable()
export class AddressBookItemSubscriber extends EncryptedEntitySubscriber<AddressBookItem> {
  protected readonly fieldConfigs: Array<EncryptedFieldConfig> = [
    { field: 'name', hashField: 'nameHash' },
  ];

  constructor(dataSource: DataSource) {
    super(dataSource);
  }

  listenTo(): typeof AddressBookItem {
    return AddressBookItem;
  }
}
