import { z } from 'zod';
import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';

export const DelegateEventPayloadSchema = z.object({
  chainId: NumericStringSchema,
  address: AddressSchema.nullish().default(null),
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
  expiryDateSeconds: z.number().nullish().default(null),
});

export const NewDelegateEventSchema = DelegateEventPayloadSchema.extend({
  type: z.literal(TransactionEventType.NEW_DELEGATE),
});

export const UpdatedDelegateEventSchema = DelegateEventPayloadSchema.extend({
  type: z.literal(TransactionEventType.UPDATED_DELEGATE),
});

export const DeletedDelegateEventSchema = DelegateEventPayloadSchema.extend({
  type: z.literal(TransactionEventType.DELETED_DELEGATE),
});

export type NewDelegateEvent = z.infer<typeof NewDelegateEventSchema>;

export type UpdatedDelegateEvent = z.infer<typeof UpdatedDelegateEventSchema>;

export type DeletedDelegateEvent = z.infer<typeof DeletedDelegateEventSchema>;
