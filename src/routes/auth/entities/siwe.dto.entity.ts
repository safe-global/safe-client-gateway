import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class SiweDto implements z.infer<typeof SiweDtoSchema> {
  @ApiProperty()
  message!: string;
  @ApiProperty()
  signature!: `0x${string}`;

  constructor(props: SiweDto) {
    this.message = props.message;
    this.signature = props.signature;
  }
}

export const SiweDtoSchema = z.object({
  message: z.string(),
  signature: HexSchema,
});
