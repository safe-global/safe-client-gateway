import { JSONSchemaType } from 'ajv';
import { Chain } from '../../../../domain/chains/entities/chain.entity';
import { NativeCurrency } from '../../../../domain/chains/entities/native.currency.entity';

const nativeCurrencySchema: JSONSchemaType<NativeCurrency> = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    symbol: { type: 'string' },
    decimals: { type: 'number' },
    logoUri: { type: 'string' },
  },
  required: [],
};

const chainSchema: JSONSchemaType<Chain> = {
  type: 'object',
  properties: {
    chainId: { type: 'string' },
    chainName: { type: 'string' },
    transactionService: { type: 'string' },
    vpcTransactionService: { type: 'string' },
    nativeCurrency: { $ref: 'nativeCurrency' },
  },
  required: ['chainId', 'chainName', 'transactionService'],
};

export { chainSchema, nativeCurrencySchema };
