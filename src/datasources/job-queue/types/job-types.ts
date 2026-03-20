// SPDX-License-Identifier: FSL-1.1-MIT
export enum JobType {
  TEST_JOB = 'test-job', // for testing purposes
  CSV_EXPORT = 'csv-export',
  PUSH_NOTIFICATION_EVENT = 'push-notification-event',
  PUSH_NOTIFICATION_DELIVERY = 'push-notification-delivery',
}

export type JobTypeName = (typeof JobType)[keyof typeof JobType];

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JobData {}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface JobResponse {}
