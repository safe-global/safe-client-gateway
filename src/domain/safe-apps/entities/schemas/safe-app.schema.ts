import { JSONSchemaType, Schema } from 'ajv';
import {
  SafeAppAccessControl,
  SafeAppAccessControlPolicies,
} from '@/domain/safe-apps/entities/safe-app-access-control.entity';
import { SafeAppProvider } from '@/domain/safe-apps/entities/safe-app-provider.entity';
import { SafeAppSocialProfile } from '@/domain/safe-apps/entities/safe-app-social-profile.entity';

export const SAFE_APP_PROVIDER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe-apps/safe-app-provider.json';

export const safeAppProviderSchema: JSONSchemaType<SafeAppProvider> = {
  $id: SAFE_APP_PROVIDER_SCHEMA_ID,
  type: 'object',
  properties: {
    url: { type: 'string' },
    name: { type: 'string' },
  },
  required: ['url', 'name'],
};

export const SAFE_APP_ACCESS_CONTROL_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe-apps/safe-app-access-control.json';

export const safeAppAccessControlSchema: JSONSchemaType<SafeAppAccessControl> =
  {
    $id: SAFE_APP_ACCESS_CONTROL_SCHEMA_ID,
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

export const SAFE_APP_SOCIAL_PROFILE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe-apps/safe-app-social-profile.json';

export const safeAppSocialProfileSchema: JSONSchemaType<SafeAppSocialProfile> =
  {
    $id: SAFE_APP_SOCIAL_PROFILE_SCHEMA_ID,
    type: 'object',
    properties: {
      platform: { type: 'string' },
      url: { type: 'string', format: 'uri' },
    },
    required: ['platform', 'url'],
  };

export const SAFE_APP_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe-apps/safe-app.json';

export const safeAppSchema: Schema = {
  $id: SAFE_APP_SCHEMA_ID,
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
