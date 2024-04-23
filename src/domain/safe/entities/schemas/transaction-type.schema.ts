import { buildZodPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { z } from 'zod';
import { EthereumTransactionTypeSchema } from '@/domain/safe/entities/ethereum-transaction.entity';
import { ModuleTransactionTypeSchema } from '@/domain/safe/entities/module-transaction.entity';
import { MultisigTransactionTypeSchema } from '@/domain/safe/entities/multisig-transaction.entity';

const TransactionTypeSchema = z.discriminatedUnion('txType', [
  EthereumTransactionTypeSchema,
  ModuleTransactionTypeSchema,
  MultisigTransactionTypeSchema,
]);

export const TransactionTypePageSchema = buildZodPageSchema(
  TransactionTypeSchema,
);
