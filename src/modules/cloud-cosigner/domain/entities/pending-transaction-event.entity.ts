// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';

/**
 * The one Transaction Service event the cosigner reacts to. Declared here,
 * rather than imported from the hooks module's `routes/`, so this module only
 * depends on the wire format it consumes.
 */
export const PENDING_MULTISIG_TRANSACTION_EVENT =
  'PENDING_MULTISIG_TRANSACTION';

export const PendingTransactionEventSchema = z.object({
  type: z.literal(PENDING_MULTISIG_TRANSACTION_EVENT),
  chainId: z.string(),
  address: AddressSchema,
  safeTxHash: HexSchema,
});

export type PendingTransactionEvent = z.infer<
  typeof PendingTransactionEventSchema
>;
