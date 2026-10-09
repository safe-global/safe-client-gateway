// SPDX-License-Identifier: FSL-1.1-MIT
import { jest } from 'bun:test';
import type { MockedObject } from '#/__tests__/mocks';
import type { INotificationsRepositoryV2 } from '#/modules/notifications/domain/v2/notifications.repository.interface';

export const MockNotificationRepositoryV2: MockedObject<INotificationsRepositoryV2> =
  {
    enqueueNotification: jest.fn(),
    upsertSubscriptions: jest.fn(),
    getSafeSubscription: jest.fn(),
    getSubscribersBySafe: jest.fn(),
    deleteSubscription: jest.fn(),
    deleteAllSubscriptions: jest.fn(),
    deleteDevice: jest.fn(),
  };
