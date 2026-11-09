// SPDX-License-Identifier: FSL-1.1-MIT
import { z } from 'zod';
import { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';
import { HookEventBaseSchema } from '#/modules/hooks/routes/entities/schemas/hook-event-base.schema';

export const SafeConfigUpdatedEventSchema = HookEventBaseSchema.extend({
  type: z.literal(TransactionEventType.SAFE_CONFIG_UPDATED),
  txHash: z.string(),
});
