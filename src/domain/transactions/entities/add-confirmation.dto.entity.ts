import type { AddConfirmationDtoSchema } from '@/routes/transactions/entities/schemas/add-confirmation.dto.schema';
import type { z } from 'zod';

export class AddConfirmationDto
  implements z.infer<typeof AddConfirmationDtoSchema>
{
  signature!: `0x${string}`;
}
