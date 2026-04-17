import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Address } from 'viem';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const TransactionDataDtoSchema = z.object({
  data: HexSchema,
  to: AddressSchema,
});

export class TransactionDataDto implements z.infer<
  typeof TransactionDataDtoSchema
> {
  @ApiProperty({ description: 'Hexadecimal value' })
  data: Address;
  @ApiPropertyOptional({ description: 'The target Ethereum address' })
  to: Address;

  constructor(data: Address, to: Address) {
    this.data = data;
    this.to = to;
  }
}
