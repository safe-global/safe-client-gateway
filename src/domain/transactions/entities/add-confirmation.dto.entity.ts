import type { AddConfirmationDtoSchema } from '@/routes/transactions/entities/schemas/add-confirmation.dto.schema';
import type { z } from 'zod';
import type { Address } from 'viem';

export class AddConfirmationDto
  implements z.infer<typeof AddConfirmationDtoSchema>
{
  signature!: Address;
}
