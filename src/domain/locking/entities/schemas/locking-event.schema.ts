import { buildZodPageSchema } from '@/domain/entities/schemas/page.schema.factory';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';
import { HexSchema } from '@/validation/entities/schemas/hex.schema';
import { NumericStringSchema } from '@/validation/entities/schemas/numeric-string.schema';
import { z } from 'zod';

export const enum LockingEventType {
  LOCKED = 'LOCKED',
  UNLOCKED = 'UNLOCKED',
  WITHDRAWN = 'WITHDRAWN',
}

const LockEventSchema = z.object({
  executionDate: z.coerce.date(),
  transactionHash: HexSchema,
  holder: AddressSchema,
  amount: NumericStringSchema,
  logIndex: NumericStringSchema,
});

export const LockEventItemSchema = LockEventSchema.extend({
  eventType: z.literal(LockingEventType.LOCKED),
});

const UnlockEventSchema = z.object({
  executionDate: z.coerce.date(),
  transactionHash: HexSchema,
  holder: AddressSchema,
  amount: NumericStringSchema,
  logIndex: NumericStringSchema,
  unlockIndex: NumericStringSchema,
});

export const UnlockEventItemSchema = UnlockEventSchema.extend({
  eventType: z.literal(LockingEventType.UNLOCKED),
});

const WithdrawEventSchema = z.object({
  executionDate: z.coerce.date(),
  transactionHash: HexSchema,
  holder: AddressSchema,
  amount: NumericStringSchema,
  logIndex: NumericStringSchema,
  unlockIndex: NumericStringSchema,
});

export const WithdrawEventItemSchema = WithdrawEventSchema.extend({
  eventType: z.literal(LockingEventType.WITHDRAWN),
});

export const LockingEventSchema = z.discriminatedUnion('eventType', [
  LockEventItemSchema,
  UnlockEventItemSchema,
  WithdrawEventItemSchema,
]);

export const LockingEventPageSchema = buildZodPageSchema(LockingEventSchema);
