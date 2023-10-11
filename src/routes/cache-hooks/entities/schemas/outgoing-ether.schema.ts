import { JSONSchemaType } from 'ajv';
import { EventType } from '@/routes/cache-hooks/entities/event-payload.entity';
import { OutgoingEther } from '@/routes/cache-hooks/entities/outgoing-ether.entity';

export const OUTGOING_ETHER_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/outgoing-ether.json';

export const outgoingEtherEventSchema: JSONSchemaType<OutgoingEther> = {
  $id: OUTGOING_ETHER_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.OUTGOING_ETHER },
    txHash: { type: 'string' },
    value: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'txHash', 'value'],
};
