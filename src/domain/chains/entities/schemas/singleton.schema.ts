import { JSONSchemaType } from 'ajv';
import { Singleton } from '@/domain/chains/entities/singleton.entity';

export const SINGLETON_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/chains/singleton.json';

export const singletonSchema: JSONSchemaType<Singleton> = {
  $id: SINGLETON_SCHEMA_ID,
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
