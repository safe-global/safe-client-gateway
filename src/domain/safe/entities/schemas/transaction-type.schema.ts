import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';
import { EthereumTransactionTypeSchema } from '@/domain/safe/entities/ethereum-transaction.entity';
import { ModuleTransactionTypeSchema } from '@/domain/safe/entities/module-transaction.entity';
import {
  _MultisigTransactionTypeSchema,
  MultisigTransactionSchema,
} from '@/domain/safe/entities/multisig-transaction.entity';

const TransactionTypeSchema = z
  .discriminatedUnion('txType', [
    EthereumTransactionTypeSchema,
    ModuleTransactionTypeSchema,
    _MultisigTransactionTypeSchema,
  ])
  .refine(async (value) => {
    // TODO: Find way to centralize refinement to MultisigTransactionSchema
    if (value.txType === 'MULTISIG_TRANSACTION') {
      // Refine confirmations
      return MultisigTransactionSchema.parseAsync(value);
    }
    return value;
  });

export const TransactionTypePageSchema = buildPageSchema(TransactionTypeSchema);
