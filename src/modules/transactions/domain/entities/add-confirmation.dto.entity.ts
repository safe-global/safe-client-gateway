import type { Address } from 'viem';
import type { z } from 'zod';
import type { AddConfirmationDtoSchema } from '@/modules/transactions/routes/entities/schemas/add-confirmation.dto.schema';

export class AddConfirmationDto implements z.infer<
  typeof AddConfirmationDtoSchema
> {
  signature!: Address;
}
