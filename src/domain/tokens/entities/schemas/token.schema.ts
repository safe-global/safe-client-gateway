import { JSONSchemaType } from 'ajv';
import { Token, TokenType } from '../token.entity';

export const tokenSchema: JSONSchemaType<Token> = {
  $id: 'https://safe-client.safe.global/schemas/tokens/token.json',
  type: 'object',
  properties: {
    address: { type: 'string' },
    decimals: { type: 'number', nullable: true },
    logoUri: { type: 'string' },
    name: { type: 'string' },
    symbol: { type: 'string' },
    type: { type: 'string', enum: Object.values(TokenType) },
  },
  required: ['address', 'decimals', 'logoUri', 'name', 'symbol', 'type'],
};
