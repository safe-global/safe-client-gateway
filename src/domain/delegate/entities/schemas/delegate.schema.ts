import { JSONSchemaType } from 'ajv';
import { Delegate } from '../delegate.entity';

export const delegateSchema: JSONSchemaType<Delegate> = {
  type: 'object',
  properties: {
    safe: { type: 'string', nullable: true },
    delegate: { type: 'string' },
    delegator: { type: 'string' },
    label: { type: 'string' },
  },
  required: ['delegate', 'delegator', 'label'],
};
