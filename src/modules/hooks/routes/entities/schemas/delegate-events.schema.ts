import { z } from 'zod';
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import {
  NullableAddressSchema,
  NullableNumberSchema,
} from '@/validation/entities/schemas/nullable.schema';

export const DelegateEventPayloadSchema = z.object({
  chainId: NumericStringSchema,
  address: NullableAddressSchema,
  delegate: AddressSchema,
  delegator: AddressSchema,
  label: z.string(),
  expiryDateSeconds: NullableNumberSchema,
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
