import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { PendingTransaction } from '../pending-transaction.entity';

export const pendingTransactionEventSchema: JSONSchemaType<PendingTransaction> =
  {
    $id: 'https://safe-client.safe.global/schemas/cache-hooks/pending-transaction.json',
    type: 'object',
    properties: {
      address: { type: 'string' },
      chainId: { type: 'string' },
      type: { type: 'string', const: EventType.PENDING_MULTISIG_TRANSACTION },
      safeTxHash: { type: 'string' },
    },
    required: ['address', 'chainId', 'type', 'safeTxHash'],
  };
