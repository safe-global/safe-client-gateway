import { Schema } from 'ajv';

export const SIMPLE_BALANCE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/balances/simple-balance.json';

const simpleBalanceSchema: Schema = {
  $id: SIMPLE_BALANCE_SCHEMA_ID,
  type: 'object',
  properties: {
    tokenAddress: { type: 'string', nullable: true, default: null },
    token: { anyOf: [{ type: 'null' }, { $ref: 'balance-token.json' }] },
    balance: { type: 'string' },
  },
  required: ['balance'],
};

export { simpleBalanceSchema };
