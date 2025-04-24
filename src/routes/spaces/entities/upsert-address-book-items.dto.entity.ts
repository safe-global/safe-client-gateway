import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { ApiProperty } from '@nestjs/swagger';

const AddressBookItemSchema = z.object({
  name: z.string(),
  address: AddressSchema,
  chainIds: z.array(z.string()),
});

class AddressBookItem implements z.infer<typeof AddressBookItemSchema> {
  @ApiProperty({ type: String })
  readonly name!: string;

  @ApiProperty({ type: String })
  readonly address!: `0x${string}`;

  @ApiProperty({ type: String, isArray: true })
  readonly chainIds!: Array<string>;
}

export const UpsertAddressBookItemsSchema = z.object({
  items: z.array(AddressBookItemSchema),
});

export class UpsertAddressBookItemsDto
  implements z.infer<typeof UpsertAddressBookItemsSchema>
{
  @ApiProperty({ type: AddressBookItem, isArray: true })
  public readonly items!: Array<AddressBookItem>;
}
