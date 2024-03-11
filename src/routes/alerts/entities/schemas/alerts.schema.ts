import { EventType } from '@/routes/alerts/entities/alert.dto.entity';
import { z } from 'zod';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export const AlertLogSchema = z.object({
  address: AddressSchema,
  topics: z.array(z.string()),
  data: z.string(),
});

export const AlertTransactionSchema = z.object({
  network: z.string(),
  block_hash: z.string(),
  block_number: z.number(),
  hash: z.string(),
  from: AddressSchema,
  to: AddressSchema,
  logs: z.array(AlertLogSchema),
  input: z.string(),
  value: z.string(),
  nonce: z.string(),
  gas: z.string(),
  gas_used: z.string(),
  cumulative_gas_used: z.string(),
  gas_price: z.string(),
  gas_tip_cap: z.string(),
  gas_fee_cap: z.string(),
});

export const AlertSchema = z.object({
  id: z.string(),
  event_type: z.nativeEnum(EventType),
  transaction: AlertTransactionSchema,
});
