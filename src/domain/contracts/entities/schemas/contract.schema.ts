import { Schema } from 'ajv';

export const contractSchema: Schema = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    name: { type: 'string' },
    displayName: { type: 'string' },
    logoUri: { type: 'string', nullable: true, default: null },
    contractAbi: { type: 'object', nullable: true, default: null },
    trustedForDelegateCall: { type: 'boolean' },
  },
  required: ['address', 'name', 'displayName', 'trustedForDelegateCall'],
  additionalProperties: false,
};
