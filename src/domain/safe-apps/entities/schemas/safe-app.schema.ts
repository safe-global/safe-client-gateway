import { JSONSchemaType, Schema } from 'ajv';
import {
  SafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '../safe-app-access-control.entity';
import { SafeAppProvider } from '../safe-app-provider.entity';
import { SafeAppSocialProfile } from '../safe-app-social-profile.entity';

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
    anyOf: [
      {
        properties: {
          type: {
            type: 'string',
            enum: [SafeAppAccessControlPolicies.DomainAllowlist],
          },
          value: {
            type: 'array',
            items: { type: 'string', format: 'uri' },
            nullable: true,
          },
        },
        required: ['type', 'value'],
      },
      {
        properties: {
          type: {
            type: 'string',
            not: { enum: [SafeAppAccessControlPolicies.DomainAllowlist] },
          },
        },
      },
    ],
    required: ['type'],
  };

export const safeAppSocialProfileSchema: JSONSchemaType<SafeAppSocialProfile> =
  {
    $id: 'https://safe-client.safe.global/schemas/safe-apps/safe-app-social-profile.json',
    type: 'object',
    properties: {
      platform: { type: 'string' },
      url: { type: 'string', format: 'uri' },
    },
    required: ['platform', 'url'],
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
    developerWebsite: { type: 'string', format: 'uri', nullable: true },
    socialProfiles: {
      type: 'array',
      items: { $ref: 'safe-app-social-profile.json' },
    },
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
    'socialProfiles',
  ],
};
