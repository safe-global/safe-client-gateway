import { faker } from '@faker-js/faker';
import { sample } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { Device, DeviceType } from '../device.entity';

export function deviceBuilder(): IBuilder<Device> {
  return Builder.new<Device>()
    .with('uuid', faker.datatype.uuid())
    .with('cloud_messaging_token', faker.datatype.uuid())
    .with('buildNumber', faker.random.numeric())
    .with('bundle', faker.internet.domainName())
    .with(
      'device_type',
      sample(Object.values(DeviceType)) ?? DeviceType.Android,
    )
    .with('version', faker.system.semver())
    .with('timestamp', faker.date.recent().getTime().toString());
}
