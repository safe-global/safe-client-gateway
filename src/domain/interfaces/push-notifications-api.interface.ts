export const IPushNotificationsApi = Symbol('IPushNotificationsApi');

export interface IPushNotificationsApi {
  enqueueNotification(token: string, notification: unknown): Promise<void>;
}
