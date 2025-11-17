import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';
import type { Address } from 'viem';

export class SiweDto implements z.infer<typeof SiweDtoSchema> {
  @ApiProperty()
  message!: string;
  @ApiProperty()
  signature!: Address;

  constructor(props: SiweDto) {
    this.message = props.message;
    this.signature = props.signature;
  }
}

export const SiweDtoSchema = z.object({
  message: z.string(),
  signature: HexSchema,
});
