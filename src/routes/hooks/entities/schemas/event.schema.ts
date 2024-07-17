import { z } from 'zod';
import { ChainUpdateEventSchema } from '@/routes/hooks/entities/schemas/chain-update.schema';
import { DeletedMultisigTransactionEventSchema } from '@/routes/hooks/entities/schemas/deleted-multisig-transaction.schema';
import { ExecutedTransactionEventSchema } from '@/routes/hooks/entities/schemas/executed-transaction.schema';
import { IncomingEtherEventSchema } from '@/routes/hooks/entities/schemas/incoming-ether.schema';
import { IncomingTokenEventSchema } from '@/routes/hooks/entities/schemas/incoming-token.schema';
import { MessageCreatedEventSchema } from '@/routes/hooks/entities/schemas/message-created.schema';
import { ModuleTransactionEventSchema } from '@/routes/hooks/entities/schemas/module-transaction.schema';
import { NewConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-confirmation.schema';
import { NewMessageConfirmationEventSchema } from '@/routes/hooks/entities/schemas/new-message-confirmation.schema';
import { OutgoingEtherEventSchema } from '@/routes/hooks/entities/schemas/outgoing-ether.schema';
import { OutgoingTokenEventSchema } from '@/routes/hooks/entities/schemas/outgoing-token.schema';
import { PendingTransactionEventSchema } from '@/routes/hooks/entities/schemas/pending-transaction.schema';
import { SafeAppsUpdateEventSchema } from '@/routes/hooks/entities/schemas/safe-apps-update.schema';
import { SafeCreatedEventSchema } from '@/routes/hooks/entities/schemas/safe-created.schema';

export const EventSchema = z.discriminatedUnion('type', [
  ChainUpdateEventSchema,
  DeletedMultisigTransactionEventSchema,
  ExecutedTransactionEventSchema,
  IncomingEtherEventSchema,
  IncomingTokenEventSchema,
  MessageCreatedEventSchema,
  ModuleTransactionEventSchema,
  NewConfirmationEventSchema,
  NewMessageConfirmationEventSchema,
  OutgoingEtherEventSchema,
  OutgoingTokenEventSchema,
  PendingTransactionEventSchema,
  SafeAppsUpdateEventSchema,
  SafeCreatedEventSchema,
]);
