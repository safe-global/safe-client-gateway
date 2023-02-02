import { ApiExtraModels, ApiProperty, getSchemaPath } from '@nestjs/swagger';
import { Device } from './device.entity';
import { SafeRegistration } from './safe-registration.entity';

@ApiExtraModels(SafeRegistration)
export class RegisterDeviceDto {
  @ApiProperty()
  deviceData: Device;
  @ApiProperty({
    type: 'array',
    items: { $ref: getSchemaPath(SafeRegistration) },
  })
  safeRegistration: SafeRegistration[];
}
