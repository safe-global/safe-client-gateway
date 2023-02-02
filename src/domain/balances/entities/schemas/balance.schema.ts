import { JSONSchemaType, Schema } from 'ajv';
import { BalanceToken } from '../balance.token.entity';

const balanceTokenSchema: JSONSchemaType<BalanceToken> = {
  $id: 'https://safe-client.safe.global/schemas/balances/balance-token.json',
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
  $id: 'https://safe-client.safe.global/schemas/balances/balance.json',
  type: 'object',
  properties: {
    tokenAddress: { type: 'string', nullable: true, default: null },
    token: { anyOf: [{ type: 'null' }, { $ref: 'balance-token.json' }] },
    balance: { type: 'string' },
    fiatBalance: { type: 'string' },
    fiatConversion: { type: 'string' },
  },
  required: ['balance', 'fiatBalance', 'fiatConversion'],
};

export { balanceSchema, balanceTokenSchema };
