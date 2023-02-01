import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { NewConfirmation } from '../new-confirmation.entity';

export const newConfirmationEventSchema: JSONSchemaType<NewConfirmation> = {
  $id: 'https://safe-client.safe.global/schemas/cache-hooks/new-confirmation.json',
  type: 'object',
  properties: {
    address: { type: 'string' },
    chainId: { type: 'string' },
    type: { type: 'string', enum: [EventType.NEW_CONFIRMATION] },
    owner: { type: 'string' },
    safeTxHash: { type: 'string' },
  },
  required: ['address', 'chainId', 'type', 'owner', 'safeTxHash'],
};
