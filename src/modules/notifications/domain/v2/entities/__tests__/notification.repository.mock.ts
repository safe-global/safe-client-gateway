import type { MockedObject } from 'vitest';
import type { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';

export const MockNotificationRepositoryV2: MockedObject<INotificationsRepositoryV2> =
  {
    enqueueNotification: vi.fn(),
    upsertSubscriptions: vi.fn(),
    getSafeSubscription: vi.fn(),
    getSubscribersBySafe: vi.fn(),
    deleteSubscription: vi.fn(),
    deleteAllSubscriptions: vi.fn(),
    deleteDevice: vi.fn(),
  };
