import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { IncomingToken } from '../incoming-token.entity';

export const incomingTokenEventSchema: JSONSchemaType<IncomingToken> = {
  $id: 'https://safe-client.safe.global/schemas/cache-hooks/incoming-token.json',
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
