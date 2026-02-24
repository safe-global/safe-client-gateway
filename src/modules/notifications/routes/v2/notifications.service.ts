import { AuthPayload } from '@/modules/auth/domain/entities/auth-payload.entity';
import { type UpsertSubscriptionsDto } from '@/modules/notifications/domain/v2/entities/upsert-subscriptions.dto.entity';
import { Inject, Injectable } from '@nestjs/common';
import { type UUID } from 'crypto';
import { NotificationTypeResponseDto } from '@/modules/notifications/routes/v2/entities/notification-type-response.dto.entity';
import { INotificationsRepositoryV2 } from '@/modules/notifications/domain/v2/notifications.repository.interface';
import type { Address } from 'viem';

@Injectable()
export class NotificationsServiceV2 {
  constructor(
    @Inject(INotificationsRepositoryV2)
    private readonly notificationsRepository: INotificationsRepositoryV2,
  ) {}

  async upsertSubscriptions(args: {
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
  }): Promise<{
    deviceUuid: UUID;
  }> {
    return this.notificationsRepository.upsertSubscriptions(args);
  }

  async getSafeSubscription(args: {
    authPayload: AuthPayload;
    deviceUuid: UUID;
    chainId: string;
    safeAddress: Address;
  }): Promise<Array<NotificationTypeResponseDto>> {
    return await this.notificationsRepository.getSafeSubscription(args);
  }

  async deleteSubscription(args: {
    deviceUuid: UUID;
    chainId: string;
    safeAddress: Address;
  }): Promise<void> {
    await this.notificationsRepository.deleteSubscription(args);
  }

  async deleteAllSubscriptions(args: {
    subscriptions: Array<{
      chainId: string;
      deviceUuid: UUID;
      safeAddress: Address;
    }>;
  }): Promise<void> {
    await this.notificationsRepository.deleteAllSubscriptions(args);
  }

  async deleteDevice(deviceUuid: UUID): Promise<void> {
    await this.notificationsRepository.deleteDevice(deviceUuid);
  }
}
