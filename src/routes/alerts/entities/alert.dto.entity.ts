import {
  AlertLogSchema,
  AlertSchema,
  AlertTransactionSchema,
} from '@/routes/alerts/entities/schemas/alerts.schema';
import { z } from 'zod';

export class AlertLog implements z.infer<typeof AlertLogSchema> {
  address!: `0x${string}`;
  topics!: Array<string>;
  data!: string;
}

export class AlertTransaction
  implements z.infer<typeof AlertTransactionSchema>
{
  network!: string;
  block_hash!: string;
  block_number!: number;
  hash!: string;
  from!: `0x${string}`;
  to!: `0x${string}`;
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
