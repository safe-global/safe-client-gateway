import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { DeviceType } from '@/modules/notifications/domain/v1/entities/device.entity';
import { SafeRegistration } from '@/modules/notifications/routes/v1/entities/safe-registration.entity';
import type { UUID } from 'crypto';

@ApiExtraModels(SafeRegistration)
export class RegisterDeviceDto {
  @ApiPropertyOptional({ type: String, nullable: true })
  uuid?: UUID;
  @ApiProperty()
  cloudMessagingToken!: string;
  @ApiProperty()
  buildNumber!: string;
  @ApiProperty()
  bundle!: string;
  @ApiProperty()
  deviceType!: DeviceType;
  @ApiProperty()
  version!: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  timestamp?: string;
  @ApiProperty({
    type: 'array',
    items: { $ref: getSchemaPath(SafeRegistration) },
  })
  safeRegistrations!: Array<SafeRegistration>;
}
