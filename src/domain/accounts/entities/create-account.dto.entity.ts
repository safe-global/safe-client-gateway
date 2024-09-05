import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';

export const CreateAccountDtoSchema = z.object({
  address: AddressSchema,
  name: z
    .string()
    .min(3, { message: 'Account names must be at least 3 characters long' })
    .max(20, { message: 'Account names must be at most 20 characters long' })
    .regex(/^[a-zA-Z0-9]([._-]?[a-zA-Z0-9]+)*$/, {
      message:
        'Account names must start with a letter or number and can contain alphanumeric characters, periods, underscores, and hyphens',
    }),
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
