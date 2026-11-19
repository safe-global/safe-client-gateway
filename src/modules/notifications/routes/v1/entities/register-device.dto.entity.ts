// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import {
  ApiExtraModels,
  ApiProperty,
  ApiPropertyOptional,
  getSchemaPath,
} from '@nestjs/swagger';
import { z } from 'zod';
import { DeviceType } from '#/modules/notifications/domain/v1/entities/device.entity';
import {
  SafeRegistration,
  SafeRegistrationSchema,
} from '#/modules/notifications/routes/v1/entities/safe-registration.entity';
import { NumericStringSchema } from '#/validation/entities/schemas/numeric-string.schema';
import { UuidSchema } from '#/validation/entities/schemas/uuid.schema';

export const RegisterDeviceDtoSchema = z.object({
  uuid: UuidSchema.nullish(),
  cloudMessagingToken: z.string(),
  buildNumber: z.string(),
  bundle: z.string(),
  deviceType: z.enum(DeviceType),
  version: z.string(),
  timestamp: NumericStringSchema.nullish(),
  safeRegistrations: z.array(SafeRegistrationSchema),
});

@ApiExtraModels(SafeRegistration)
export class RegisterDeviceDto
  implements z.infer<typeof RegisterDeviceDtoSchema>
{
  @ApiPropertyOptional({ type: String, nullable: true })
  uuid?: UUID | null;
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
  timestamp?: string | null;
  @ApiProperty({
    type: 'array',
    items: { $ref: getSchemaPath(SafeRegistration) },
  })
  safeRegistrations!: Array<SafeRegistration>;
}
