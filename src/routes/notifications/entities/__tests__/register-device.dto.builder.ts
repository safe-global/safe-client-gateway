import { random, range } from 'lodash';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { RegisterDeviceDto } from '../register-device.dto.entity';
import { deviceBuilder } from './device.builder';
import { safeRegistrationBuilder } from './safe-registration.builder';

export function registerDeviceDtoBuilder(): IBuilder<RegisterDeviceDto> {
  return Builder.new<RegisterDeviceDto>()
    .with('deviceData', deviceBuilder().build())
    .with(
      'safeRegistration',
      range(random(10)).map(() => safeRegistrationBuilder().build()),
    );
}
