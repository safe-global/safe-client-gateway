import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { IncomingEther } from '../incoming-ether.entity';

export const INCOMING_ETHER_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/incoming-ether.json';

export const incomingEtherEventSchema: JSONSchemaType<IncomingEther> = {
  $id: INCOMING_ETHER_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.INCOMING_ETHER },
    txHash: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'txHash', 'value'],
};
