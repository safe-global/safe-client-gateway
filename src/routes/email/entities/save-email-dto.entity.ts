import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class SaveEmailDto implements z.infer<typeof SaveEmailDtoSchema> {
  @ApiProperty()
  emailAddress!: string;

  @ApiProperty()
  signer!: `0x${string}`;
}

export const SaveEmailDtoSchema = z.object({
  emailAddress: z.string().email(),
  signer: AddressSchema,
});
