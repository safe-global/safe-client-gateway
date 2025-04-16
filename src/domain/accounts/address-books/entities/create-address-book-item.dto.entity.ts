import { NameSchema } from '@/domain/common/entities/name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreateAddressBookItemDtoSchema = z.object({
  name: NameSchema,
  address: AddressSchema,
});

export class CreateAddressBookItemDto
  implements z.infer<typeof CreateAddressBookItemDtoSchema>
{
  name: string;
  address: `0x${string}`;

  constructor(props: CreateAddressBookItemDto) {
    this.name = props.name;
    this.address = props.address;
  }
}
