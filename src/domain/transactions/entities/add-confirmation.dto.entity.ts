import { AddConfirmationDtoSchema } from '@/routes/transactions/entities/schemas/add-confirmation.dto.schema';
import { z } from 'zod';

export class AddConfirmationDto
  implements z.infer<typeof AddConfirmationDtoSchema>
{
  signedSafeTxHash!: string;
}
