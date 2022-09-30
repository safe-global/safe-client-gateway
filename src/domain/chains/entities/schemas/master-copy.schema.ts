import { JSONSchemaType } from 'ajv';
import { MasterCopy } from '../master-copies.entity';

export const masterCopySchema: JSONSchemaType<MasterCopy> = {
  type: 'object',
  properties: {
    address: { type: 'string' },
    version: { type: 'string' },
    deployer: { type: 'string' },
    deployedBlockNumber: { type: 'number' },
    lastIndexedBlockNumber: { type: 'number' },
    l2: { type: 'boolean' },
  },
  required: [
    'address',
    'version',
    'deployer',
    'deployedBlockNumber',
    'lastIndexedBlockNumber',
    'l2',
  ],
};
