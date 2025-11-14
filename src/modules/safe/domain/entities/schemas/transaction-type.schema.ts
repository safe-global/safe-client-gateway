import { buildPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';
import { EthereumTransactionTypeSchema } from '@/modules/safe/domain/entities/ethereum-transaction.entity';
import { ModuleTransactionTypeSchema } from '@/modules/safe/domain/entities/module-transaction.entity';
import { MultisigTransactionTypeSchema } from '@/modules/safe/domain/entities/multisig-transaction.entity';

const TransactionTypeSchema = z.discriminatedUnion('txType', [
  EthereumTransactionTypeSchema,
  ModuleTransactionTypeSchema,
  MultisigTransactionTypeSchema,
]);

export const TransactionTypePageSchema = buildPageSchema(TransactionTypeSchema);
