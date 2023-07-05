import { JSONSchemaType, Schema } from 'ajv';
import { buildPageSchema } from '../../../entities/schemas/page.schema.factory';
import { Token, TokenType } from '../token.entity';

export const tokenSchema: JSONSchemaType<Token> = {
  $id: 'https://safe-client.safe.global/schemas/tokens/token.json',
  type: 'object',
  properties: {
    address: { type: 'string' },
    decimals: { oneOf: [{ type: 'number' }, { type: 'null', nullable: true }] },
    logoUri: { type: 'string' },
    name: { type: 'string' },
    symbol: { type: 'string' },
    type: { type: 'string', enum: Object.values(TokenType) },
  },
  required: ['address', 'decimals', 'logoUri', 'name', 'symbol', 'type'],
};

export const tokenPageSchema: Schema = buildPageSchema(
  'https://safe-client.safe.global/schemas/tokens/token-page.json',
  tokenSchema,
);
