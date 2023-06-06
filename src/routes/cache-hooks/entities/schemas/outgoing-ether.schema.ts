import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { OutgoingEther } from '../outgoing-ether.entity';

export const outgoingEtherEventSchema: JSONSchemaType<OutgoingEther> = {
  $id: 'https://safe-client.safe.global/schemas/cache-hooks/outgoing-ether.json',
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
