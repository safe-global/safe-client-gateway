import { JSONSchemaType } from 'ajv';
import { EventType } from '../event-payload.entity';
import { NewConfirmation } from '../new-confirmation.entity';

export const newConfirmationEventSchema: JSONSchemaType<NewConfirmation> = {
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
