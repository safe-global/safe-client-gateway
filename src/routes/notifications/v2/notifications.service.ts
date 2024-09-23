import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification-type.entity';
import { UpsertSubscriptionsDto } from '@/routes/notifications/v1/entities/upsert-subscriptions.dto.entity';
import { INotificationsRepositoryV2 } from '@/domain/notifications/v2/notifications.repository.interface';
import { Inject, Injectable } from '@nestjs/common';
import { UUID } from 'crypto';

@Injectable()
export class NotificationsServiceV2 {
  constructor(
    @Inject(INotificationsRepositoryV2)
    private readonly notificationsRepository: INotificationsRepositoryV2,
  ) {}

  upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }> {
    return this.notificationsRepository.upsertSubscriptions(args);
  }
  getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<Array<NotificationType>> {
    return this.notificationsRepository.getSafeSubscription(args);
  }

  deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: `0x${string}`;
  }): Promise<void> {
    return this.notificationsRepository.deleteSubscription(args);
  }

  deleteDevice(deviceUuid: UUID): Promise<void> {
    return this.notificationsRepository.deleteDevice(deviceUuid);
  }
}
