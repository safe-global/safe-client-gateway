import { JSONSchemaType, Schema } from 'ajv';
import { SafeAppAccessControl } from '../safe-app-access-control.entity';
import { SafeAppProvider } from '../safe-app-provider.entity';

export const safeAppProviderSchema: JSONSchemaType<SafeAppProvider> = {
  $id: 'https://safe-client.safe.global/schemas/safe-apps/safe-app-provider.json',
  type: 'object',
  properties: {
    url: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['url', 'name'],
};

export const safeAppAccessControlSchema: JSONSchemaType<SafeAppAccessControl> =
  {
    $id: 'https://safe-client.safe.global/schemas/safe-apps/safe-app-access-control.json',
    type: 'object',
    properties: {
      type: { type: 'string' },
    },
    required: ['type'],
  };

export const safeAppSchema: Schema = {
  $id: 'https://safe-client.safe.global/schemas/safe-apps/safe-app.json',
  type: 'object',
  properties: {
    id: { type: 'number' },
    url: { type: 'string' },
    name: { type: 'string' },
    iconUrl: { type: 'string' },
    description: { type: 'string' },
    chainIds: { type: 'array', items: { type: 'number' } },
    provider: { anyOf: [{ type: 'null' }, { $ref: 'safe-app-provider.json' }] },
    accessControl: { $ref: 'safe-app-access-control.json' },
    tags: { type: 'array', items: { type: 'string' } },
    features: { type: 'array', items: { type: 'string' } },
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
    'features',
  ],
};
