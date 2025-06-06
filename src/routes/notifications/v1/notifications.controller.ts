import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Inject,
  Param,
  Post,
} from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { ValidationPipe } from '@/validation/pipes/validation.pipe';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import type { UpsertSubscriptionsSafesDto } from '@/routes/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification.entity';
import type { UUID } from 'crypto';
import { NotificationsServiceV2 } from '@/routes/notifications/v2/notifications.service';
import {
  keccak256,
  recoverAddress,
  recoverMessageAddress,
  toBytes,
} from 'viem';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { DeviceType } from '@/domain/notifications/v1/entities/device.entity';

@ApiTags('notifications')
@Controller({ path: '', version: '1' })
export class NotificationsController {
  private static REGISTRATION_TIMESTAMP_EXPIRY = 5 * 60;
  constructor(
    @Inject(NotificationsServiceV2)
    private readonly notificationServiceV2: NotificationsServiceV2,
  ) {}

  @ApiOkResponse()
  @ApiOperation({ deprecated: true })
  @Post('register/notifications')
  @HttpCode(200)
  async registerDevice(
    @Body() registerDeviceDto: RegisterDeviceDto,
  ): Promise<void> {
    if (registerDeviceDto.timestamp) {
      this.validateTimestamp(parseInt(registerDeviceDto.timestamp));
    }

    const compatibleV2Requests =
      await this.createV2RegisterDto(registerDeviceDto);

    const v2Requests = [];

    const deleteAllDeviceOwners =
      registerDeviceDto.deviceType !== DeviceType.Web;

    if (deleteAllDeviceOwners && registerDeviceDto.uuid !== undefined) {
      // Some clients, such as the mobile app, do not call the delete endpoint to remove an owner key.
      // Instead, they resend the updated list of owners without the key they want to delete.
      // In such cases, we need to clear all the previous owners to ensure the update is applied correctly.
      await this.notificationServiceV2.deleteDevice(registerDeviceDto.uuid);
    }

    for (const compatibleV2Request of compatibleV2Requests) {
      v2Requests.push(
        await this.notificationServiceV2.upsertSubscriptions(
          compatibleV2Request,
        ),
      );
    }
    await Promise.all(v2Requests);
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
      const signatureArray = safeV1Registration.signatures.length
        ? safeV1Registration.signatures
        : [undefined]; // The signature for mobile clients can be empty so we need to pass undefined here
      for (const safeV1Signature of signatureArray) {
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
              signature: (safeV1Signature as `0x${string}`) ?? undefined,
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
    }

    for (const [index, safeV2] of safeV2Array.entries()) {
      const safeAddresses = safeV2.upsertSubscriptionsDto.safes.map(
        (safeV2Safes) => safeV2Safes.address,
      );

      let recoveredAddress: `0x${string}` | undefined = undefined;
      if (safeV2.upsertSubscriptionsDto.signature) {
        recoveredAddress = await this.recoverAddress({
          registerDeviceDto: args,
          safeV2Dto: safeV2,
          safeAddresses,
        });
      }

      safeV2.authPayload.chain_id =
        safeV2.upsertSubscriptionsDto.safes[0].chainId;
      safeV2.authPayload.signer_address = recoveredAddress;

      safeV2Array[index].authPayload = safeV2.authPayload;
    }

    return safeV2Array;
  }

  private validateTimestamp(timestamp: number): void {
    const now = new Date().getTime();
    const expires = Math.floor(
      (now + NotificationsController.REGISTRATION_TIMESTAMP_EXPIRY) / 1000,
    );

    if (
      Math.abs(expires - timestamp) >
      NotificationsController.REGISTRATION_TIMESTAMP_EXPIRY
    ) {
      throw new BadRequestException('The signature is expired!');
    }
  }

  private async recoverAddress(args: {
    registerDeviceDto: RegisterDeviceDto;
    safeV2Dto: Parameters<NotificationsServiceV2['upsertSubscriptions']>[0] & {
      upsertSubscriptionsDto: {
        safes: Array<UpsertSubscriptionsSafesDto>;
        signature: `0x${string}`;
      };
    };
    safeAddresses: Array<`0x${string}`>;
  }): Promise<`0x${string}`> {
    /**
     * @todo Explore the feasibility of using a unified method to recover signatures for both web and other clients.
     */
    if (args.registerDeviceDto.deviceType === DeviceType.Web) {
      return await recoverMessageAddress({
        message: {
          raw: this.messageToRecover(args),
        },
        signature: args.safeV2Dto.upsertSubscriptionsDto.signature,
      });
    } else {
      return await recoverAddress({
        hash: this.messageToRecover(args),
        signature: args.safeV2Dto.upsertSubscriptionsDto.signature,
      });
    }
  }

  @ApiOperation({ deprecated: true })
  @Delete('chains/:chainId/notifications/devices/:uuid')
  async unregisterDevice(
    @Param('chainId') _: string, // We need to keep this parameter for the swagger documentation
    @Param('uuid', new ValidationPipe(UuidSchema)) uuid: UUID,
  ): Promise<void> {
    await this.notificationServiceV2.deleteDevice(uuid);
  }

  @ApiOperation({ deprecated: true })
  @Delete('chains/:chainId/notifications/devices/:uuid/safes/:safeAddress')
  async unregisterSafe(
    @Param('chainId') chainId: string,
    @Param('uuid', new ValidationPipe(UuidSchema)) uuid: UUID,
    @Param('safeAddress', new ValidationPipe(AddressSchema))
    safeAddress: `0x${string}`,
  ): Promise<void> {
    await this.notificationServiceV2.deleteSubscription({
      deviceUuid: uuid,
      chainId: chainId,
      safeAddress: safeAddress,
    });
  }

  private messageToRecover(args: {
    registerDeviceDto: RegisterDeviceDto;
    safeV2Dto: Parameters<NotificationsServiceV2['upsertSubscriptions']>[0] & {
      upsertSubscriptionsDto: {
        safes: Array<UpsertSubscriptionsSafesDto>;
        signature: `0x${string}`;
      };
    };
    safeAddresses: Array<`0x${string}`>;
  }): `0x${string}` {
    return keccak256(
      toBytes(
        `gnosis-safe${args.registerDeviceDto.timestamp}${args.registerDeviceDto.uuid}${args.registerDeviceDto.cloudMessagingToken}${args.safeAddresses.sort().join('')}`,
      ),
    );
  }
}
