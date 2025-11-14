import type { Operation } from '@/domain/safe/entities/operation.entity';
import type { ProposeTransactionDtoSchema } from '@/modules/transactions/routes/entities/schemas/propose-transaction.dto.schema';
import type { z } from 'zod';
import type { Address, Hash, Hex } from 'viem';

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
}
