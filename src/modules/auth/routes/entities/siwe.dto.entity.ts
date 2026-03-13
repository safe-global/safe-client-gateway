import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Hex } from 'viem';

export class SiweDto implements z.infer<typeof SiweDtoSchema> {
  @ApiProperty()
  message!: string;
  @ApiProperty()
  signature!: Hex;
}

export const SiweDtoSchema = z
  .object({
    message: z.string(),
    signature: HexSchema,
  })
  .strict();
