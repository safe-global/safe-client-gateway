import { JSONSchemaType } from 'ajv';
import { MasterCopy } from '../master-copies.entity';

export const MASTER_COPY_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/master-copy.json';

export const masterCopySchema: JSONSchemaType<MasterCopy> = {
  $id: MASTER_COPY_SCHEMA_ID,
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
