import { faker } from '@faker-js/faker';
import { random, range, sample } from 'lodash';
import { DeviceType } from '../../../../domain/notifications/entities/device.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { RegisterDeviceDto } from '../register-device.dto.entity';
import { safeRegistrationBuilder } from './safe-registration.builder';

export function registerDeviceDtoBuilder(): IBuilder<RegisterDeviceDto> {
  return Builder.new<RegisterDeviceDto>()
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
