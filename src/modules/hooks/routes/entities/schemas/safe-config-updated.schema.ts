// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '#/modules/hooks/routes/entities/schemas/hook-event-base.schema';
import { AddressSchema } from '#/validation/entities/schemas/address.schema';

export const SafeConfigOwnerChanges: ReadonlyArray<string> = [
  'ADDED_OWNER',
  'REMOVED_OWNER',
];

// `change` stays an open string so a change type added by the Transaction Service does not reject the event
export const SafeConfigUpdatedEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.SAFE_CONFIG_UPDATED),
  txHash: z.string(),
  change: z.string(),
  data: z.object({
    owner: AddressSchema.optional(),
  }),
}).refine(
  (event) =>
    !SafeConfigOwnerChanges.includes(event.change) ||
    event.data.owner !== undefined,
  {
    path: ['data', 'owner'],
    message: 'An owner change must include the owner',
  },
);
