import { JSONSchemaType, Schema } from 'ajv';
import { BalanceToken } from '../balance.token.entity';

const balanceTokenSchema: JSONSchemaType<BalanceToken> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    symbol: { type: 'string' },
    decimals: { type: 'number' },
    logoUri: { type: 'string' },
  },
  required: ['name', 'symbol', 'decimals', 'logoUri'],
};

const balanceSchema: Schema = {
  type: 'object',
  properties: {
    tokenAddress: { type: 'string', nullable: true },
    token: { anyOf: [{ type: 'null' }, { $ref: 'balanceToken' }] },
    balance: { type: 'string' },
    fiatBalance: { type: 'string' },
    fiatConversion: { type: 'string' },
  },
  required: ['balance', 'fiatBalance', 'fiatConversion'],
};

export { balanceSchema, balanceTokenSchema };
