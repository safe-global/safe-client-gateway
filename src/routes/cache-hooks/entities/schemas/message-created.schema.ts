import { JSONSchemaType } from 'ajv';
import { MessageCreated } from '../message-created.entity';
import { EventType } from '../event-payload.entity';

export const MESSAGE_CREATED_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/executed-transaction.json';

export const messageCreatedEventSchema: JSONSchemaType<MessageCreated> = {
  $id: MESSAGE_CREATED_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.MESSAGE_CREATED },
    messageHash: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'messageHash'],
};
