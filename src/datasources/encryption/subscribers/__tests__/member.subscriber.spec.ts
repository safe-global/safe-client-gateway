// SPDX-License-Identifier: FSL-1.1-MIT
import { MemberSubscriber } from '@/datasources/encryption/subscribers/member.subscriber';
import { Member } from '@/modules/users/datasources/entities/member.entity.db';
import type { DataSource, EntitySubscriberInterface } from 'typeorm';

const mockDataSource = {
  subscribers: [] as Array<EntitySubscriberInterface>,
} as unknown as DataSource;

describe('MemberSubscriber', () => {
  const subscriber = new MemberSubscriber(mockDataSource);

  it('should listen to Member entity', () => {
    expect(subscriber.listenTo()).toBe(Member);
  });

  it('should configure name field encryption', () => {
    expect(subscriber['fieldConfigs']).toEqual([
      { field: 'name', hashField: 'nameHash' },
    ]);
  });
});
