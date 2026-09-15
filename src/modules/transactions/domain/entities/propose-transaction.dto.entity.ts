// SPDX-License-Identifier: FSL-1.1-MIT
import type { Address, Hash, Hex } from 'viem';
import type { z } from 'zod';
import type { Operation } from '@/modules/safe/domain/entities/operation.entity';
import type {
  NestedTransactionDtoSchema,
  ProposeTransactionDtoSchema,
} from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';

export class NestedTransactionDto
  implements z.infer<typeof NestedTransactionDtoSchema>
{
  to!: Address | null;
  value!: string;
  data!: Hex | null;
  operation!: Operation;
  safeTxGas!: string;
  baseGas!: string;
  gasPrice!: string;
  gasToken!: Address | null;
  refundReceiver!: Address | null;
  nonce!: string;
  notes!: string | null;
}

export class ProposeTransactionDto
  implements z.infer<typeof ProposeTransactionDtoSchema>
{
  to!: Address;
  value!: string;
  data!: Hex | null;
  nonce!: string;
  operation!: Operation;
  safeTxGas!: string;
  baseGas!: string;
  gasPrice!: string;
  gasToken!: Address;
  refundReceiver!: Address | null;
  safeTxHash!: Hash;
  sender!: Address;
  signature!: Hex | null;
  origin!: string | null;
  nestedTransaction!: NestedTransactionDto | null;
}
