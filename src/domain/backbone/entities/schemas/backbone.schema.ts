import { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { JSONSchemaType } from 'ajv';

export const BACKBONE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/backbone/backbone.json';

export const backboneSchema: JSONSchemaType<Backbone> = {
  $id: BACKBONE_SCHEMA_ID,
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
