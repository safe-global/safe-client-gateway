import { NameSchema } from '@/domain/common/entities/name.schema';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { z } from 'zod';
import type { Address } from 'viem';

export const CreateAccountDtoSchema = z.object({
  address: AddressSchema,
  name: NameSchema,
});

export class CreateAccountDto implements z.infer<
  typeof CreateAccountDtoSchema
> {
  address: Address;
  name: string;

  constructor(props: CreateAccountDto) {
    this.address = props.address;
    this.name = props.name;
  }
}
