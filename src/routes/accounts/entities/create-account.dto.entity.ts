import { CreateAccountDtoSchema } from '@/routes/accounts/entities/schemas/create-account.dto.schema';
import { ApiProperty } from '@nestjs/swagger';
import { z } from 'zod';

export class CreateAccountDto
  implements z.infer<typeof CreateAccountDtoSchema>
{
  @ApiProperty()
  address!: `0x${string}`;
}
