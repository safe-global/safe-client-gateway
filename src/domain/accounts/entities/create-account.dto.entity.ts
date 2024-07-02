import { CreateAccountDtoSchema } from '@/domain/accounts/entities/schemas/create-account.dto.schema';
import { z } from 'zod';

export class CreateAccountDto
  implements z.infer<typeof CreateAccountDtoSchema>
{
  address: `0x${string}`;

  constructor(props: CreateAccountDto) {
    this.address = props.address;
  }
}
