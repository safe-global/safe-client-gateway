// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { Hex } from 'viem';
import { z } from 'zod';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

const SAFE_TX_HASH_LENGTH = 66;

export const CreateSafenetCheckDtoSchema = z.object({
  safeTxHash: HexSchema.length(SAFE_TX_HASH_LENGTH),
});

export class CreateSafenetCheckDto
  implements z.infer<typeof CreateSafenetCheckDtoSchema>
{
  @ApiProperty({ type: String, description: 'Safe transaction hash' })
  public readonly safeTxHash!: Hex;
}
