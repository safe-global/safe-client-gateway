export type FirebaseNotification = {
  notification?: NotificationContent;
  data?: Record<string, string>;
};

export type NotificationContent = {
  title?: string;
  body?: string;
};

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
