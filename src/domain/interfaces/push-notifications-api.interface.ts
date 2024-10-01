import type { FirebaseNotification } from '@/datasources/push-notifications-api/entities/firebase-notification.entity';

export const IPushNotificationsApi = Symbol('IPushNotificationsApi');

export interface IPushNotificationsApi {
  enqueueNotification(
    token: string,
    notification: FirebaseNotification,
  ): Promise<void>;
}
