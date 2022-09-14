import { JSONSchemaType } from 'ajv';
import { ExecutedTransaction } from '../executed-transaction.entity';
import { EventType } from '../event-payload.entity';

export const executedTransactionEventSchema: JSONSchemaType<ExecutedTransaction> =
  {
    type: 'object',
    properties: {
      address: { type: 'string' },
      chainId: { type: 'string' },
      type: { type: 'string', enum: [EventType.EXECUTED_MULTISIG_TRANSACTION] },
      safeTxHash: { type: 'string' },
      txHash: { type: 'string' },
    },
    required: ['address', 'chainId', 'type', 'safeTxHash', 'txHash'],
  };
