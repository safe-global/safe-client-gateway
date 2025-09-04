import { AddRecoveryModuleDtoSchema } from '@/routes/recovery/entities/schemas/add-recovery-module.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class AddRecoveryModuleDto
  implements z.infer<typeof AddRecoveryModuleDtoSchema>
{
  @ApiProperty()
  moduleAddress!: Address;
}
