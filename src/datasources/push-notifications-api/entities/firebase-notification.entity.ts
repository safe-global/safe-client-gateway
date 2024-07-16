export type FirebaseNotification<T extends Record<string, unknown>> = {
  title: string;
  body: string;
  data: T;
};
