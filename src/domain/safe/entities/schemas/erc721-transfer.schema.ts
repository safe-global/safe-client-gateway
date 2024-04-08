import { Schema } from 'ajv';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

export const Erc721TransferSchema = z.object({
  type: z.literal('ERC721_TRANSFER'),
  executionDate: z.coerce.date(),
  blockNumber: z.number(),
  transactionHash: HexSchema,
  to: AddressSchema,
  from: AddressSchema,
  tokenId: z.string(),
  tokenAddress: AddressSchema.nullish().default(null),
  transferId: z.string(),
});

// TODO: Remove after migrating transactionTypeSchema
export const ERC721_TRANSFER_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/safe/erc721-transfer.json';

export const erc721TransferSchema: Schema = {
  $id: ERC721_TRANSFER_SCHEMA_ID,
  type: 'object',
  properties: {
    type: {
      type: 'string',
      const: 'ERC721_TRANSFER',
    },
    executionDate: { type: 'string', isDate: true },
    blockNumber: { type: 'number' },
    transactionHash: { type: 'string' },
    to: { type: 'string' },
    from: { type: 'string' },
    tokenId: { type: 'string' },
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
    'tokenId',
    'transferId',
  ],
};
