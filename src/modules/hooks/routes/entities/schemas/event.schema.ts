import { z } from 'zod';
import { ChainUpdateEventSchema } from '@/modules/hooks/routes/entities/schemas/chain-update.schema';
import { DeletedMultisigTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/deleted-multisig-transaction.schema';
import { ExecutedTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/executed-transaction.schema';
import { IncomingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/incoming-ether.schema';
import { IncomingTokenEventSchema } from '@/modules/hooks/routes/entities/schemas/incoming-token.schema';
import { MessageCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/message-created.schema';
import { ModuleTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/module-transaction.schema';
import { NewConfirmationEventSchema } from '@/modules/hooks/routes/entities/schemas/new-confirmation.schema';
import { NewMessageConfirmationEventSchema } from '@/modules/hooks/routes/entities/schemas/new-message-confirmation.schema';
import { OutgoingEtherEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-ether.schema';
import { OutgoingTokenEventSchema } from '@/modules/hooks/routes/entities/schemas/outgoing-token.schema';
import { PendingTransactionEventSchema } from '@/modules/hooks/routes/entities/schemas/pending-transaction.schema';
import { ReorgDetectedEventSchema } from '@/modules/hooks/routes/entities/schemas/reorg-detected.schema';
import { SafeAppsUpdateEventSchema } from '@/modules/hooks/routes/entities/schemas/safe-apps-update.schema';
import { SafeCreatedEventSchema } from '@/modules/hooks/routes/entities/schemas/safe-created.schema';
import {
  DeletedDelegateEventSchema,
  NewDelegateEventSchema,
  UpdatedDelegateEventSchema,
} from '@/modules/hooks/routes/entities/schemas/delegate-events.schema';

export const EventSchema = z.discriminatedUnion('type', [
  ChainUpdateEventSchema,
  DeletedMultisigTransactionEventSchema,
  ExecutedTransactionEventSchema,
  DeletedDelegateEventSchema,
  IncomingEtherEventSchema,
  IncomingTokenEventSchema,
  MessageCreatedEventSchema,
  ModuleTransactionEventSchema,
  NewDelegateEventSchema,
  NewConfirmationEventSchema,
  NewMessageConfirmationEventSchema,
  OutgoingEtherEventSchema,
  OutgoingTokenEventSchema,
  PendingTransactionEventSchema,
  ReorgDetectedEventSchema,
  SafeAppsUpdateEventSchema,
  SafeCreatedEventSchema,
  UpdatedDelegateEventSchema,
]);
