// SPDX-License-Identifier: FSL-1.1-MIT
import { AddressBookItemSubscriber } from '@/datasources/encryption/subscribers/address-book-item.subscriber';
import { AddressBookItem } from '@/modules/spaces/datasources/entities/address-book-item.entity.db';
import type { DataSource, EntitySubscriberInterface } from 'typeorm';

const mockDataSource = {
  subscribers: [] as Array<EntitySubscriberInterface>,
} as unknown as DataSource;

describe('AddressBookItemSubscriber', () => {
  const subscriber = new AddressBookItemSubscriber(mockDataSource);

  it('should listen to AddressBookItem entity', () => {
    expect(subscriber.listenTo()).toBe(AddressBookItem);
  });

  it('should configure name field encryption', () => {
    expect(subscriber['fieldConfigs']).toEqual([
      { field: 'name', hashField: 'nameHash' },
    ]);
  });
});
