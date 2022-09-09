import { JSONSchemaType } from 'ajv';
import { Backbone } from '../../../backbone/entities/backbone.entity';

const backboneSchema: JSONSchemaType<Backbone> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    api_version: { type: 'string' },
    secure: { type: 'boolean' },
    host: { type: 'string' },
    headers: { type: 'array', items: { type: 'string' } },
    settings: { type: 'object' },
  },
  required: ['name', 'version', 'api_version', 'secure', 'host'],
  additionalProperties: false,
};

export { backboneSchema };
