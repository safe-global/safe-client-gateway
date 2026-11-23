// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';
import { HexSchema } from '#/validation/entities/schemas/hex.schema';

export type ApprovalLog = z.infer<typeof ApprovalLogSchema>;

/**
 * A log of the `Approval(address,address,uint256)` event. ERC-20 and ERC-721
 * share the signature, so it can be either.
 */
export const ApprovalLogSchema = z.object({
  address: AddressSchema,
  topics: z.tuple([HexSchema], HexSchema),
  data: HexSchema,
});
