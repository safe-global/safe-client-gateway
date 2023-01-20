import { JSONSchemaType } from 'ajv';
import { Backbone } from '../backbone.entity';

export const backboneSchema: JSONSchemaType<Backbone> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    version: { type: 'string' },
    api_version: { type: 'string' },
    secure: { type: 'boolean' },
    host: { type: 'string' },
    headers: { type: 'array', items: { type: 'string' } },
    settings: {
      type: 'object',
      propertyNames: { type: 'string' },
      required: [],
    },
  },
  required: ['name', 'version', 'api_version', 'secure', 'host'],
};
