import { JSONSchemaType } from 'ajv';
import { ExecutedTransaction } from '../executed-transaction.entity';
import { EventType } from '../event-payload.entity';

export const EXECUTED_TRANSACTION_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/executed-transaction.json';

export const executedTransactionEventSchema: JSONSchemaType<ExecutedTransaction> =
  {
    $id: EXECUTED_TRANSACTION_EVENT_SCHEMA_ID,
    type: 'object',
    properties: {
      address: { type: 'string' },
      chainId: { type: 'string' },
      type: { type: 'string', const: EventType.EXECUTED_MULTISIG_TRANSACTION },
      safeTxHash: { type: 'string' },
      txHash: { type: 'string' },
    },
    required: ['address', 'chainId', 'type', 'safeTxHash', 'txHash'],
  };
