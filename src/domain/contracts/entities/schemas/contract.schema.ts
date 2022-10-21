import { JSONSchemaType } from 'ajv';
import { Contract } from '../contract.entity';

const contractSchema: JSONSchemaType<Contract> = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    name: { type: 'string' },
    displayName: { type: 'string' },
    logoUri: { type: 'string', nullable: true },
    contractAbi: { type: 'object', nullable: true },
    trustedForDelegateCall: { type: 'boolean' },
  },
  required: ['address', 'name', 'displayName', 'trustedForDelegateCall'],
  additionalProperties: false,
};

export { contractSchema };
