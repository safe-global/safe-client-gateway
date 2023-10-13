import { JSONSchemaType } from 'ajv';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';

export const COLLECTIBLE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/collectibles/collectible.json';

export const collectibleSchema: JSONSchemaType<Collectible> = {
  $id: COLLECTIBLE_SCHEMA_ID,
  type: 'object',
  properties: {
    address: { type: 'string' },
    tokenName: { type: 'string' },
    tokenSymbol: { type: 'string' },
    logoUri: { type: 'string' },
    id: { type: 'string' },
    // Do not use format: 'uri' as it fails on some payloads that should be considered valid
    uri: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    name: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    description: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    // Do not use format: 'uri' as it fails on some payloads that should be considered valid
    imageUri: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    metadata: {
      oneOf: [{ type: 'object' }, { type: 'null', nullable: true }],
      default: null,
    },
  },
  required: ['address', 'tokenName', 'tokenSymbol', 'logoUri', 'id'],
};
