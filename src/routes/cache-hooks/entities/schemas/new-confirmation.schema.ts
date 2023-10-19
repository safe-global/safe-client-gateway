import { JSONSchemaType } from 'ajv';
import { EventType } from '@/routes/cache-hooks/entities/event-payload.entity';
import { NewConfirmation } from '@/routes/cache-hooks/entities/new-confirmation.entity';

export const NEW_CONFIRMATION_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/new-confirmation.json';

export const newConfirmationEventSchema: JSONSchemaType<NewConfirmation> = {
  $id: NEW_CONFIRMATION_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', const: EventType.NEW_CONFIRMATION },
    owner: { type: 'string' },
    safeTxHash: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'owner', 'safeTxHash'],
};
