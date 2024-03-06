import { z } from 'zod';

export const DeleteTransactionSchema = z.object({ signature: z.string() });
