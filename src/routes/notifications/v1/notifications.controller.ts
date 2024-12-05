import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { NotificationsService } from '@/routes/notifications/v1/notifications.service';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { UpsertSubscriptionsSafesDto } from '@/routes/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification.entity';
import type { UUID } from 'crypto';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import { recoverMessageAddress } from 'viem';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { IConfigurationService } from '@/config/configuration.service.interface';

@ApiTags('notifications')
@Controller({ path: '', version: '1' })
export class NotificationsController {
  private isPushNotificationV2Enabled = false;
  constructor(
    // Adding NotificationServiceV2 to ensure compatibility with V1.
    // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
    @Inject(NotificationsServiceV2)
    private readonly notificationServiceV2: NotificationsServiceV2,
    private readonly notificationsService: NotificationsService,

    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
  ) {
    this.isPushNotificationV2Enabled =
      this.configurationService.getOrThrow<boolean>(
        'features.pushNotifications',
      );
  }

  @ApiOkResponse()
  @Post('register/notifications')
  @HttpCode(200)
  async registerDevice(
    @Body() registerDeviceDto: RegisterDeviceDto,
  ): Promise<void> {
    await this.notificationsService.registerDevice(registerDeviceDto);

    if (this.isPushNotificationV2Enabled) {
      // Compatibility with V2
      // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
      const compatibleV2Requests =
        await this.createV2RegisterDto(registerDeviceDto);

      const v2Requests = [];
      for (const compatibleV2Request of compatibleV2Requests) {
        v2Requests.push(
          await this.notificationServiceV2.upsertSubscriptions(
            compatibleV2Request,
          ),
        );
      }

      await Promise.all(v2Requests);
    }
  }

  private async createV2RegisterDto(
    args: RegisterDeviceDto,
  ): Promise<
    Array<Parameters<NotificationsServiceV2['upsertSubscriptions']>[0]>
  > {
    const safeV2Array: Array<
      Parameters<NotificationsServiceV2['upsertSubscriptions']>[0] & {
        upsertSubscriptionsDto: {
          safes: Array<UpsertSubscriptionsSafesDto>;
          signature: `0x${string}`;
        };
      }
    > = [];

    const safesV1Registrations = args.safeRegistrations;

    for (const safeV1Registration of safesV1Registrations) {
      if (safeV1Registration.safes.length) {
        const safeV2: Parameters<
          NotificationsServiceV2['upsertSubscriptions']
        >[0] & {
          upsertSubscriptionsDto: {
            safes: Array<UpsertSubscriptionsSafesDto>;
            signature: `0x${string}`;
          };
        } = {
          upsertSubscriptionsDto: {
            cloudMessagingToken: args.cloudMessagingToken,
            deviceType: args.deviceType,
            deviceUuid: (args.uuid as UUID) || undefined,
            safes: [],
            signature: safeV1Registration.signatures[0] as `0x${string}`,
          },
          authPayload: new AuthPayload(),
        };
        const uniqueSafeAddresses = new Set(safeV1Registration.safes);
        for (const safeAddresses of uniqueSafeAddresses) {
          safeV2.upsertSubscriptionsDto.safes.push({
            address: safeAddresses as `0x${string}`,
            chainId: safeV1Registration.chainId,
            notificationTypes: Object.values(NotificationType),
          });
        }
        safeV2Array.push(safeV2);
      }
    }

    for (const [index, safeV2] of safeV2Array.entries()) {
      const safeAddresses = safeV2.upsertSubscriptionsDto.safes.map(
        (safeV2Safes) => safeV2Safes.address,
      );

      const recoveredAddress = await recoverMessageAddress({
        message: `gnosis-safe${args.timestamp}${args.uuid}${args.cloudMessagingToken}${safeAddresses.sort().join('')}`,
        signature: safeV2.upsertSubscriptionsDto.signature,
      });

      safeV2.authPayload.chain_id =
        safeV2.upsertSubscriptionsDto.safes[0].chainId;
      safeV2.authPayload.signer_address = recoveredAddress;

      safeV2Array[index].authPayload = safeV2.authPayload;
    }

    return safeV2Array;
  }

  @Delete('chains/:chainId/notifications/devices/:uuid')
  async unregisterDevice(
    @Param('chainId') chainId: string,
    @Param('uuid', new ValidationPipe(UuidSchema)) uuid: UUID,
  ): Promise<void> {
    await this.notificationsService.unregisterDevice({ chainId, uuid });

    if (this.isPushNotificationV2Enabled) {
      // Compatibility with V2
      // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
      await this.notificationServiceV2.deleteDevice(uuid);
    }
  }

  @Delete('chains/:chainId/notifications/devices/:uuid/safes/:safeAddress')
  async unregisterSafe(
    @Param('chainId') chainId: string,
    @Param('uuid', new ValidationPipe(UuidSchema)) uuid: UUID,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<void> {
    await this.notificationsService.unregisterSafe({
      chainId,
      uuid,
      safeAddress,
    });

    if (this.isPushNotificationV2Enabled) {
      // Compatibility with V2
      // @TODO Remove NotificationModuleV2 after all clients have migrated and compatibility is no longer needed.
      await this.notificationServiceV2.deleteSubscription({
        deviceUuid: uuid,
        chainId: chainId,
        safeAddress: safeAddress,
      });
    }
  }
}
