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
} from '#/modules/notifications/routes/v1/entities/safe-registration.dto.entity';
import { NonNegativeNumericStringSchema } from '#/validation/entities/schemas/non-negative-numeric-string.schema';
import { UuidSchema } from '#/validation/entities/schemas/uuid.schema';

export const RegisterDeviceDtoSchema = z.object({
  uuid: UuidSchema.nullish(),
  cloudMessagingToken: z.string(),
  // Never read by the gateway, so not required
  buildNumber: z.string().optional(),
  bundle: z.string().optional(),
  deviceType: z.enum(DeviceType),
  version: z.string().optional(),
  // Integer seconds: parseInt of other numeric forms (e.g. "Infinity") skips the expiry check
  timestamp: NonNegativeNumericStringSchema.nullish(),
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
  @ApiPropertyOptional()
  buildNumber?: string;
  @ApiPropertyOptional()
  bundle?: string;
  @ApiProperty()
  deviceType!: DeviceType;
  @ApiPropertyOptional()
  version?: string;
  @ApiPropertyOptional({ type: String, nullable: true })
  timestamp?: string | null;
  @ApiProperty({
    type: 'array',
    items: { $ref: getSchemaPath(SafeRegistration) },
  })
  safeRegistrations!: Array<SafeRegistration>;
}
