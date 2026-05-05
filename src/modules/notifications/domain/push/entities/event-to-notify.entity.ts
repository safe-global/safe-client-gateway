// SPDX-License-Identifier: FSL-1.1-MIT
import { TransactionEventType } from '@/modules/hooks/routes/entities/event-type.entity';
import type { DeletedMultisigTransactionEvent } from '@/modules/hooks/routes/entities/schemas/deleted-multisig-transaction.schema';
import type { ExecutedTransactionEvent } from '@/modules/hooks/routes/entities/schemas/executed-transaction.schema';
import type { IncomingEtherEvent } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';
import type { IncomingTokenEvent } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';
import type { MessageCreatedEvent } from '@/modules/hooks/routes/entities/schemas/message-created.schema';
import type { ModuleTransactionEvent } from '@/modules/hooks/routes/entities/schemas/module-transaction.schema';
import type { PendingTransactionEvent } from '@/modules/hooks/routes/entities/schemas/pending-transaction.schema';

export type EventToNotify =
  | DeletedMultisigTransactionEvent
  | ExecutedTransactionEvent
  | IncomingEtherEvent
  | IncomingTokenEvent
  | ModuleTransactionEvent
  | MessageCreatedEvent
  | PendingTransactionEvent;

/**
 * Static allowlist of event types that trigger push notifications.
 * New event types are excluded by default unless explicitly added here.
 */
export const NOTIFIABLE_EVENT_TYPES: ReadonlySet<string> = new Set([
  TransactionEventType.DELETED_MULTISIG_TRANSACTION,
  TransactionEventType.EXECUTED_MULTISIG_TRANSACTION,
  TransactionEventType.INCOMING_ETHER,
  TransactionEventType.INCOMING_TOKEN,
  TransactionEventType.MODULE_TRANSACTION,
  TransactionEventType.MESSAGE_CREATED,
  TransactionEventType.PENDING_MULTISIG_TRANSACTION,
]);
