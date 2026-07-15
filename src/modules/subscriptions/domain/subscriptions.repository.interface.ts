// SPDX-License-Identifier: FSL-1.1-MIT
import type { Space } from '@/modules/spaces/datasources/spaces/entities/space.entity.db';
import type { Subscription } from '@/modules/subscriptions/datasources/entities/subscription.entity.db';

export const ISubscriptionsRepository = Symbol('ISubscriptionsRepository');

export interface ISubscriptionsRepository {
  upsertFromEvent(args: {
    id: Subscription['id'];
    spaceId: Space['id'];
    status: Subscription['status'];
    metadata: Subscription['metadata'];
    lastEventId: Subscription['lastEventId'];
    lastEventOccurredAt: Subscription['lastEventOccurredAt'];
  }): Promise<void>;

  findBySpaceId(spaceId: Space['id']): Promise<Array<Subscription>>;

  findById(id: Subscription['id']): Promise<Subscription | null>;
}
