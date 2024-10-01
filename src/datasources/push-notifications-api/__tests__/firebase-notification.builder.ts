import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import type { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';
import { faker } from '@faker-js/faker';

export function firebaseNotificationBuilder(): IBuilder<FirebaseNotification> {
  return new Builder<FirebaseNotification>()
    .with('notification', {
      title: faker.lorem.sentence(),
      body: faker.lorem.sentence(),
    })
    .with('data', JSON.parse(fakeJson()) as Record<string, string>);
}
