import { JSONSchemaType } from 'ajv';
import { Collectible } from '../collectible.entity';

export const collectibleSchema: JSONSchemaType<Collectible> = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    tokenName: { type: 'string' },
    tokenSymbol: { type: 'string' },
    logoUri: { type: 'string' },
    id: { type: 'string' },
    uri: { type: 'string', nullable: true, format: 'uri' },
    name: { type: 'string', nullable: true },
    description: { type: 'string', nullable: true },
    imageUri: { type: 'string', nullable: true, format: 'uri' },
    metadata: { type: 'object', nullable: true },
  },
  required: ['address', 'tokenName', 'tokenSymbol', 'logoUri', 'id'],
};
