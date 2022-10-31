import { JSONSchemaType, Schema } from 'ajv';
import { SafeAppAccessControl } from '../safe-app-access-control.entity';
import { SafeAppProvider } from '../safe-app-provider.entity';

export const safeAppProviderSchema: JSONSchemaType<SafeAppProvider> = {
  type: 'object',
  properties: {
    url: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['url', 'name'],
};

export const safeAppAccessControlSchema: JSONSchemaType<SafeAppAccessControl> =
  {
    type: 'object',
    properties: {
      type: { type: 'string' },
    },
    required: ['type'],
  };

export const safeAppSchema: Schema = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    url: { type: 'string' },
    name: { type: 'string' },
    iconUrl: { type: 'string' },
    description: { type: 'string' },
    chainIds: { type: 'array', items: { type: 'number' } },
    provider: { anyOf: [{ type: 'null' }, { $ref: 'safeAppProviderSchema' }] },
    accessControl: { $ref: 'safeAppAccessControlSchema' },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'id',
    'url',
    'name',
    'iconUrl',
    'description',
    'chainIds',
    'accessControl',
    'tags',
  ],
  additionalProperties: false,
};
