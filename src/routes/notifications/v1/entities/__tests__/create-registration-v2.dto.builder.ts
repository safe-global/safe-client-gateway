import type { UpsertSubscriptionsDto } from '@/domain/notifications/v2/entities/upsert-subscriptions.dto.entity';
import { AuthPayload } from '@/domain/auth/entities/auth-payload.entity';
import { NotificationType } from '@/domain/notifications/v2/entities/notification.entity';
import type { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import {
  getAddress,
  keccak256,
  recoverAddress,
  recoverMessageAddress,
  toBytes,
} from 'viem';
import { DeviceType } from '@/domain/notifications/v1/entities/device.entity';

export const createV2RegisterDtoBuilder = async (
  args: RegisterDeviceDto,
): Promise<
  Array<{
    upsertSubscriptionsDto: UpsertSubscriptionsDto;
    authPayload: AuthPayload;
  }>
> => {
  const safeV2Array: Array<{
    authPayload: AuthPayload;
    upsertSubscriptionsDto: UpsertSubscriptionsDto & {
      signature: `0x${string}`;
    };
  }> = [];

  const safesV1Registrations = args.safeRegistrations;

  for (const safeV1Registration of safesV1Registrations) {
    if (safeV1Registration.safes.length) {
      const safeV2: (typeof safeV2Array)[number] = {
        upsertSubscriptionsDto: {
          cloudMessagingToken: args.cloudMessagingToken,
          deviceType: args.deviceType,
          deviceUuid: args.uuid ?? null,
          safes: [],
          signature: safeV1Registration.signatures[0] as `0x${string}`,
        },
        authPayload: new AuthPayload(),
      };
      for (const safeAddresses of safeV1Registration.safes) {
        safeV2.upsertSubscriptionsDto.safes.push({
          address: getAddress(safeAddresses),
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

    let recoveredAddress: `0x${string}`;
    if (args.deviceType === DeviceType.Web) {
      recoveredAddress = await recoverMessageAddress({
        message: {
          raw: messageToRecover(args, safeAddresses),
        },
        signature: safeV2.upsertSubscriptionsDto.signature,
      });
    } else {
      recoveredAddress = await recoverAddress({
        hash: messageToRecover(args, safeAddresses),
        signature: safeV2.upsertSubscriptionsDto.signature,
      });
    }

    safeV2.authPayload.chain_id =
      safeV2.upsertSubscriptionsDto.safes[0].chainId;
    safeV2.authPayload.signer_address = recoveredAddress;

    safeV2Array[index].authPayload = safeV2.authPayload;
  }

  return safeV2Array;
};

const messageToRecover = (
  args: RegisterDeviceDto,
  safeAddresses: Array<`0x${string}`>,
): `0x${string}` => {
  return keccak256(
    toBytes(
      `gnosis-safe${args.timestamp}${args.uuid}${args.cloudMessagingToken}${safeAddresses.sort().join('')}`,
    ),
  );
};
