import { Operation } from '@/domain/safe/entities/operation.entity';
import { ProposeTransactionDtoSchema } from '@/routes/transactions/entities/schemas/propose-transaction.dto.schema';
import { z } from 'zod';

export class ProposeTransactionDto
  implements z.infer<typeof ProposeTransactionDtoSchema>
{
  to!: `0x${string}`;
  value!: string;
  data!: `0x${string}` | null;
  nonce!: string;
  operation!: Operation;
  safeTxGas!: string;
  baseGas!: string;
  gasPrice!: string;
  gasToken!: `0x${string}`;
  refundReceiver!: `0x${string}` | null;
  safeTxHash!: `0x${string}`;
  sender!: `0x${string}`;
  signature!: `0x${string}` | null;
  origin!: string | null;
}
