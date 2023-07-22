import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { OutgoingToken } from '../outgoing-token.entity';

export const OUTGOING_TOKEN_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/outgoing-token.json';

export const outgoingTokenEventSchema: JSONSchemaType<OutgoingToken> = {
  $id: OUTGOING_TOKEN_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.OUTGOING_TOKEN },
    tokenAddress: { type: 'string' },
    txHash: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'tokenAddress', 'txHash'],
};
