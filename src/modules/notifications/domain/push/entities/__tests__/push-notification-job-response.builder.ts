// SPDX-License-Identifier: FSL-1.1-MIT

import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { PushNotificationJobResponse } from '@/modules/notifications/domain/push/entities/push-notification-job-data.entity';

export function pushNotificationJobResponseBuilder(): IBuilder<PushNotificationJobResponse> {
  return new Builder<PushNotificationJobResponse>().with('delivered', true);
}
