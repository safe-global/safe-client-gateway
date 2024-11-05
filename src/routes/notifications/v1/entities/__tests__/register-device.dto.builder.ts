import { faker } from '@faker-js/faker';
import { DeviceType } from '@/domain/notifications/v1/entities/device.entity';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { RegisterDeviceDto } from '@/routes/notifications/v1/entities/register-device.dto.entity';
import { safeRegistrationBuilder } from '@/routes/notifications/v1/entities/__tests__/safe-registration.builder';
import type { UUID } from 'crypto';

export async function registerDeviceDtoBuilder(args?: {
  uuid?: UUID;
  cloudMessagingToken?: UUID;
  timestamp?: number;
}): Promise<IBuilder<RegisterDeviceDto>> {
  const uuid = args?.uuid ?? (faker.string.uuid() as UUID);
  const cloudMessagingToken =
    args?.cloudMessagingToken ?? (faker.string.uuid() as UUID);
  const timestamp = new Date(args?.timestamp ?? faker.date.recent());
  timestamp.setMilliseconds(0);
  const timestampWithoutMilliseconds = timestamp.getTime();
  const signaturePrefix = 'gnosis-safe';
  const safeRegistrations = await safeRegistrationBuilder({
    signaturePrefix,
    uuid,
    cloudMessagingToken,
    timestamp: timestampWithoutMilliseconds,
  });

  return new Builder<RegisterDeviceDto>()
    .with('uuid', uuid)
    .with('cloudMessagingToken', cloudMessagingToken)
    .with('buildNumber', faker.string.numeric())
    .with('bundle', faker.internet.domainName())
    .with('deviceType', faker.helpers.objectValue(DeviceType))
    .with('version', faker.system.semver())
    .with('timestamp', timestamp.toString())
    .with(
      'safeRegistrations',
      faker.helpers.multiple(() => safeRegistrations.build(), {
        count: { min: 0, max: 10 },
      }),
    );
}
