import { z } from 'zod';
import type { Address } from 'viem';

export const UpdateAddressBookItemDtoSchema = z.object({
  id: z.number(),
  name: z.string(),
  address: z.string(),
});

export class UpdateAddressBookItemDto
  implements z.infer<typeof UpdateAddressBookItemDtoSchema>
{
  id: number;
  name: string;
  address: Address;

  constructor(props: UpdateAddressBookItemDto) {
    this.id = props.id;
    this.name = props.name;
    this.address = props.address;
  }
}
