import { JSONSchemaType } from 'ajv';
import { Collectible } from '../collectible.entity';

export const collectibleSchema: JSONSchemaType<Collectible> = {
  $id: 'https://safe-client.safe.global/schemas/collectibles/collectible.json',
  type: 'object',
  properties: {
    address: { type: 'string' },
    tokenName: { type: 'string' },
    tokenSymbol: { type: 'string' },
    logoUri: { type: 'string' },
    id: { type: 'string' },
    // Do not use format: 'uri' as it fails on some payloads that should be considered valid
    uri: { type: 'string', nullable: true, default: null },
    name: { type: 'string', nullable: true, default: null },
    description: { type: 'string', nullable: true, default: null },
    // Do not use format: 'uri' as it fails on some payloads that should be considered valid
    imageUri: { type: 'string', nullable: true, default: null },
    metadata: { type: 'object', nullable: true, default: null },
  },
  required: ['address', 'tokenName', 'tokenSymbol', 'logoUri', 'id'],
};
