// SPDX-License-Identifier: FSL-1.1-MIT
import { Module } from '@nestjs/common';
import { IPushNotificationService } from '@/modules/notifications/domain/push/push-notification.service.interface';

@Module({
  providers: [
    {
      provide: IPushNotificationService,
      useValue: {
        enqueueEvent: jest.fn(),
      },
    },
  ],
  exports: [IPushNotificationService],
})
export class TestPushNotificationModule {}
