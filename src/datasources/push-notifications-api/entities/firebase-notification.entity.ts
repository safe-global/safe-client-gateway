export type FirebaseNotification = {
  notification?: {
    title?: string;
    body?: string;
  };
  data?: Record<string, string>;
};
