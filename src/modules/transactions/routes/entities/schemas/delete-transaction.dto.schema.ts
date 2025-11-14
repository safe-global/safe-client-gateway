import { z } from 'zod';

export const DeleteTransactionDtoSchema = z.object({ signature: z.string() });
