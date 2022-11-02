import { JSONSchemaType } from 'ajv';
import { TokenInfo, TokenType } from '../token-info.entity';

export const tokenInfoSchema: JSONSchemaType<TokenInfo> = {
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
