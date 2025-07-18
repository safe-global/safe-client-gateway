import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { z } from 'zod';

export const DeleteAllSubscriptionsDtoSchema = z.object({
  subscriptions: z
    .array(
      z.object({
        chainId: NumericStringSchema,
        deviceUuid: UuidSchema,
        safeAddress: AddressSchema,
        signerAddress: AddressSchema.nullish(),
      }),
    )
    .min(1, 'At least one subscription is required'),
});

export type DeleteAllSubscriptionsDto = z.infer<
  typeof DeleteAllSubscriptionsDtoSchema
>;
