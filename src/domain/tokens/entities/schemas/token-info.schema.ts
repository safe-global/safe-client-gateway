import { JSONSchemaType } from 'ajv';
import { Token, TokenType } from '../token.entity';

export const tokenSchema: JSONSchemaType<Token> = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    decimals: { type: 'number' },
    logoUri: { type: 'string' },
    name: { type: 'string' },
    symbol: { type: 'string' },
    tokenType: { type: 'string', enum: Object.values(TokenType) },
  },
  required: ['address', 'decimals', 'logoUri', 'name', 'symbol', 'tokenType'],
};
