// SPDX-License-Identifier: FSL-1.1-MIT
import configuration from '@/config/entities/configuration';

// CSV export queue constants
export const CSV_EXPORT_QUEUE = 'csv-export';
export const CSV_EXPORT_WORKER_CONCURRENCY =
  configuration().csvExport.queue.concurrency;

// Push notification queue constants
export const PUSH_NOTIFICATION_QUEUE = 'push-notification';
export const PUSH_NOTIFICATION_WORKER_CONCURRENCY =
  configuration().pushNotifications.queue.concurrency;

// SES Email queue constants
export const SES_EMAIL_QUEUE = 'ses-email';
export const SES_EMAIL_WORKER_CONCURRENCY =
  configuration().email.ses.queue.concurrency;
