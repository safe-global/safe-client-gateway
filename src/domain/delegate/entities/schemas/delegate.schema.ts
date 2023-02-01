import { JSONSchemaType } from 'ajv';
import { Delegate } from '../delegate.entity';

export const delegateSchema: JSONSchemaType<Delegate> = {
  $id: 'https://safe-client.safe.global/schemas/delegates/delegate.json',
  type: 'object',
  properties: {
    safe: { type: 'string', nullable: true, default: null },
    delegate: { type: 'string' },
    delegator: { type: 'string' },
    label: { type: 'string' },
  },
  required: ['delegate', 'delegator', 'label'],
};
