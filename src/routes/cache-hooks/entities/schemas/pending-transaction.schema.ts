import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { PendingTransaction } from '../pending-transaction.entity';

export const PENDING_TRANSACTION_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/pending-transaction.json';

export const pendingTransactionEventSchema: JSONSchemaType<PendingTransaction> =
  {
    $id: PENDING_TRANSACTION_EVENT_SCHEMA_ID,
    type: 'object',
    properties: {
      address: { type: 'string' },
      chainId: { type: 'string' },
      type: { type: 'string', const: EventType.PENDING_MULTISIG_TRANSACTION },
      safeTxHash: { type: 'string' },
    },
    required: ['address', 'chainId', 'type', 'safeTxHash'],
  };
