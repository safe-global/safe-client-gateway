export type FirebaseNotification = {
  notification?: NotificationContent;
  data?: Record<string, string>;
};

export type NotificationContent = {
  title?: string;
  body?: string;
};

/**
 * @link https://firebase.google.com/docs/cloud-messaging/concept-options
 */
export type FireabaseNotificationApn = {
  apns: {
    payload: {
      aps: {
        alert: {
          title: string;
          body: string;
        };
        'mutable-content': 1 | 0;
      };
    };
  };
};

export type FirebaseAndroidMessageConfig = {
  android: {
    priority: 'high' | 'normal';
  };
};
