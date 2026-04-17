import { ApiProperty } from '@nestjs/swagger';
import type { Address } from 'viem';
import type { z } from 'zod';
import type { AddRecoveryModuleDtoSchema } from '@/modules/recovery/routes/entities/schemas/add-recovery-module.dto.schema';

export class AddRecoveryModuleDto implements z.infer<
  typeof AddRecoveryModuleDtoSchema
> {
  @ApiProperty()
  moduleAddress!: Address;
}
