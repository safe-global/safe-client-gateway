// SPDX-License-Identifier: FSL-1.1-MIT
import configuration from '@/config/entities/configuration';

export const CSV_EXPORT_QUEUE = 'csv-export';
export const CSV_EXPORT_WORKER_CONCURRENCY =
  configuration().csvExport.queue.concurrency;

export const PUSH_NOTIFICATION_QUEUE = 'push-notification';
export const PUSH_NOTIFICATION_WORKER_CONCURRENCY =
  configuration().pushNotifications.queue.concurrency;
