import type {
  AlertLogSchema,
  AlertSchema,
  AlertTransactionSchema,
} from '@/modules/alerts/routes/entities/schemas/alerts.schema';
import type { z } from 'zod';
import type { Address, Hex } from 'viem';

export class AlertLog implements z.infer<typeof AlertLogSchema> {
  address!: Address;
  topics!: [signature: Hex, ...Array<Address>];
  data!: Address;
}

export class AlertTransaction implements z.infer<
  typeof AlertTransactionSchema
> {
  network!: string;
  block_hash!: string;
  block_number!: number;
  hash!: string;
  from!: Address;
  to!: Address;
  logs!: Array<AlertLog>;
  input!: string;
  value!: string;
  nonce!: string;
  gas!: string;
  gas_used!: string;
  cumulative_gas_used!: string;
  gas_price!: string;
  gas_tip_cap!: string;
  gas_fee_cap!: string;
}

export enum EventType {
  ALERT = 'ALERT',
  TEST = 'TEST',
}

export class Alert implements z.infer<typeof AlertSchema> {
  id!: string;
  event_type!: EventType;
  transaction!: AlertTransaction;
}
