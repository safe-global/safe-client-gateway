import { AddRecoveryModuleDtoSchema } from '@/routes/recovery/entities/schemas/add-recovery-module.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class AddRecoveryModuleDto
  implements z.infer<typeof AddRecoveryModuleDtoSchema>
{
  @ApiProperty()
  moduleAddress!: `0x${string}`;
}
