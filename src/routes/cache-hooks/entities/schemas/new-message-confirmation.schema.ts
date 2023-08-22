import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { NewMessageConfirmation } from '../new-message-confirmation.entity';

export const NEW_MESSAGE_CONFIRMATION_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/new-message-confirmation.json';

export const newMessageConfirmationEventSchema: JSONSchemaType<NewMessageConfirmation> =
  {
    $id: NEW_MESSAGE_CONFIRMATION_EVENT_SCHEMA_ID,
    type: 'object',
    properties: {
      address: { type: 'string' },
      chainId: { type: 'string' },
      type: { type: 'string', const: EventType.MESSAGE_CONFIRMATION },
      messageHash: { type: 'string' },
    },
    required: ['address', 'chainId', 'type', 'messageHash'],
  };
