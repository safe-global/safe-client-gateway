import {
  LockEvent,
  LockType,
  LockingEvent,
  UnlockEvent,
  WithdrawEvent,
} from '@/domain/locking/entities/locking-event.entity';
import { JSONSchemaType } from 'ajv';
import { Page } from '@/routes/common/entities/page.entity';

const LOCK_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/lock-event.json';

const lockEventSchema: JSONSchemaType<LockEvent> = {
  $id: LOCK_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    type: { type: 'string', const: LockType.LOCK },
    amount: { type: 'string' },
    executedAt: { type: 'string' },
  },
  required: ['type', 'amount', 'executedAt'],
};

const UNLOCK_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/unlock-event.json';

const unlockEventSchema: JSONSchemaType<UnlockEvent> = {
  $id: UNLOCK_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    type: { type: 'string', const: LockType.UNLOCK },
    amount: { type: 'string' },
    executedAt: { type: 'string' },
    unlockIndex: { type: 'string' },
    unlockedAt: { type: 'string' },
  },
  required: ['type', 'amount', 'executedAt', 'unlockIndex', 'unlockedAt'],
};

const WITHDRAW_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/withdraw-event.json';

const withdrawEventSchema: JSONSchemaType<WithdrawEvent> = {
  $id: WITHDRAW_EVENT_SCHEMA_ID,
  type: 'object',
  properties: {
    type: { type: 'string', const: LockType.WITHDRAW },
    amount: { type: 'string' },
    executedAt: { type: 'string' },
    unlockIndex: { type: 'string' },
  },
  required: ['type', 'amount', 'executedAt', 'unlockIndex'],
};

const LOCKING_EVENT_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/locking-event.json';

const lockingEventSchema: JSONSchemaType<LockingEvent> = {
  $id: LOCKING_EVENT_SCHEMA_ID,
  type: 'object',
  discriminator: { propertyName: 'type' },
  oneOf: [lockEventSchema, unlockEventSchema, withdrawEventSchema],
};

export const LOCKING_EVENT_PAGE_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/locking/locking-event-page.json';

// TODO: Use buildPageSchema when types are fixed
export const lockingEventPageSchema: JSONSchemaType<Page<LockingEvent>> = {
  $id: LOCKING_EVENT_PAGE_SCHEMA_ID,
  type: 'object',
  properties: {
    count: {
      oneOf: [{ type: 'number' }, { type: 'null', nullable: true }],
      default: null,
    },
    next: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    previous: {
      oneOf: [{ type: 'string' }, { type: 'null', nullable: true }],
      default: null,
    },
    results: { type: 'array', items: lockingEventSchema },
  },
  required: ['results'],
};
