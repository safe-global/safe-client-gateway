import { JSONSchemaType } from 'ajv';
import { Balance } from '../balance.entity';

const balanceSchema: JSONSchemaType<Balance> = {
  type: 'object',
  properties: {
    tokenInfo: { $ref: 'tokenInfo' },
    balance: { type: 'string' },
    fiatBalance: { type: 'number' },
    fiatConversion: { type: 'number' },
  },
  required: [],
};

export { balanceSchema };
