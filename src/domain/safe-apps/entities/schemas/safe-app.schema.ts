import { JSONSchemaType } from 'ajv';
import { SafeApp } from '../../../../routes/safe-apps/entities/safe-app.entity';
import { SafeAppAccessControl } from '../safe-app-access-control.entity';
import { SafeAppProvider } from '../safe-app-provider.entity';

export const safeAppProviderSchema: JSONSchemaType<SafeAppProvider> = {
  nullable: true,
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

export const safeAppSchema: JSONSchemaType<SafeApp> = {
  type: 'object',
  properties: {
    id: { type: 'number' },
    url: { type: 'string' },
    name: { type: 'string' },
    iconUrl: { type: 'string' },
    description: { type: 'string' },
    chainIds: { type: 'array', items: { type: 'string' } },
    provider: { $ref: 'safeAppProviderSchema' },
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
