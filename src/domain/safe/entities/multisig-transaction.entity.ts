import { z } from 'zod';
import {
  ConfirmationSchema,
  MultisigTransactionSchema,
} from '@/domain/safe/entities/schemas/multisig-transaction.schema';

export type Confirmation = z.infer<typeof ConfirmationSchema>;

export type MultisigTransaction = z.infer<typeof MultisigTransactionSchema>;
