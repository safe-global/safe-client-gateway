import { NameSchema } from '@/domain/common/entities/name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreateAccountDtoSchema = z.object({
  address: AddressSchema,
  name: NameSchema,
});

export class CreateAccountDto
  implements z.infer<typeof CreateAccountDtoSchema>
{
  address: `0x${string}`;
  name: string;

  constructor(props: CreateAccountDto) {
    this.address = props.address;
    this.name = props.name;
  }
}
