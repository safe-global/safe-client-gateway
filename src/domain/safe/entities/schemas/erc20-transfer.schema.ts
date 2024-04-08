import { Schema } from 'ajv';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const Erc20TransferSchema = z.object({
  type: z.literal('ERC20_TRANSFER'),
  executionDate: z.coerce.date(),
  blockNumber: z.number(),
  transactionHash: HexSchema,
  to: AddressSchema,
  from: AddressSchema,
  value: z.string(),
  tokenAddress: AddressSchema.nullish().default(null),
  transferId: z.string(),
});

// TODO: Remove after migrating transactionTypeSchema
export const ERC20_TRANSFER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/erc20-transfer.json';

export const erc20TransferSchema: Schema = {
  $id: ERC20_TRANSFER_SCHEMA_ID,
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'ERC20_TRANSFER',
    },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    value: { type: 'string' },
    tokenAddress: { type: 'string', nullable: true, default: null },
    transferId: { type: 'string' },
  },
  required: [
    'type',
    'executionDate',
    'blockNumber',
    'transactionHash',
    'to',
    'from',
    'value',
    'transferId',
  ],
};
