import { TransactionEventType } from '@/routes/hooks/entities/event-type.entity';
import type { DeletedMultisigTransactionEvent } from '@/routes/hooks/entities/schemas/deleted-multisig-transaction.schema';
import type { ExecutedTransactionEvent } from '@/routes/hooks/entities/schemas/executed-transaction.schema';
import type { IncomingEtherEvent } from '@/routes/hooks/entities/schemas/incoming-ether.schema';
import type { IncomingTokenEvent } from '@/routes/hooks/entities/schemas/incoming-token.schema';
import type { MessageCreatedEvent } from '@/routes/hooks/entities/schemas/message-created.schema';
import type { ModuleTransactionEvent } from '@/routes/hooks/entities/schemas/module-transaction.schema';
import type { PendingTransactionEvent } from '@/routes/hooks/entities/schemas/pending-transaction.schema';

export enum NotificationType {
  CONFIRMATION_REQUEST = 'CONFIRMATION_REQUEST', // TransactionEventType.PENDING_MULTISIG_TRANSACTION
  DELETED_MULTISIG_TRANSACTION = TransactionEventType.DELETED_MULTISIG_TRANSACTION,
  EXECUTED_MULTISIG_TRANSACTION = TransactionEventType.EXECUTED_MULTISIG_TRANSACTION,
  INCOMING_ETHER = TransactionEventType.INCOMING_ETHER,
  INCOMING_TOKEN = TransactionEventType.INCOMING_TOKEN,
  MODULE_TRANSACTION = TransactionEventType.MODULE_TRANSACTION,
  MESSAGE_CONFIRMATION_REQUEST = 'MESSAGE_CONFIRMATION_REQUEST', // TransactionEventType.MESSAGE_CREATED
}

export type ConfirmationRequestNotification = Omit<
  PendingTransactionEvent,
  'type'
> & { type: NotificationType.CONFIRMATION_REQUEST };

export type DeletedMultisigTransactionNotification =
  DeletedMultisigTransactionEvent;

export type ExecutedMultisigTransactionNotification = ExecutedTransactionEvent;

export type IncomingEtherNotification = IncomingEtherEvent;

export type IncomingTokenNotification = IncomingTokenEvent;

export type ModuleTransactionNotification = ModuleTransactionEvent;

export type MessageConfirmationNotification = Omit<
  MessageCreatedEvent,
  'type'
> & {
  type: NotificationType.MESSAGE_CONFIRMATION_REQUEST;
};

export type Notification =
  | ConfirmationRequestNotification
  | DeletedMultisigTransactionNotification
  | ExecutedMultisigTransactionNotification
  | IncomingEtherNotification
  | IncomingTokenNotification
  | ModuleTransactionNotification
  | MessageConfirmationNotification;
