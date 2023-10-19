import { JSONSchemaType } from 'ajv';
import { EventType } from '@/routes/cache-hooks/entities/event-payload.entity';
import { IncomingToken } from '@/routes/cache-hooks/entities/incoming-token.entity';

export const INCOMING_TOKEN_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/incoming-token.json';

export const incomingTokenEventSchema: JSONSchemaType<IncomingToken> = {
  $id: INCOMING_TOKEN_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.INCOMING_TOKEN },
    tokenAddress: { type: 'string' },
    txHash: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'tokenAddress', 'txHash'],
};
