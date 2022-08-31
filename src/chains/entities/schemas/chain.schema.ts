import Ajv, { JSONSchemaType } from 'ajv';
import { Chain } from '../chain.entity';
import { NativeCurrency } from '../native.currency.entity';

const ajv = new Ajv();

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

ajv.addSchema(nativeCurrencySchema, 'nativeCurrency');

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

const isValidChain = ajv.compile(chainSchema);

export default isValidChain;
