import { faker } from '@faker-js/faker';
import { random, range, sample } from 'lodash';
import { DeviceType } from '@/domain/notifications/entities/device.entity';
import { Builder, IBuilder } from '@/__tests__/builder';
import { RegisterDeviceDto } from '@/routes/notifications/entities/register-device.dto.entity';
import { safeRegistrationBuilder } from '@/routes/notifications/entities/__tests__/safe-registration.builder';

export function registerDeviceDtoBuilder(): IBuilder<RegisterDeviceDto> {
  return new Builder<RegisterDeviceDto>()
    .with('uuid', faker.string.uuid())
    .with('cloudMessagingToken', faker.string.uuid())
    .with('buildNumber', faker.string.numeric())
    .with('bundle', faker.internet.domainName())
    .with('deviceType', sample(Object.values(DeviceType)) ?? DeviceType.Android)
    .with('version', faker.system.semver())
    .with('timestamp', faker.date.recent().getTime().toString())
    .with(
      'safeRegistrations',
      range(random(10)).map(() => safeRegistrationBuilder().build()),
    );
}
