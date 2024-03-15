import { z } from 'zod';
import { ChainUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/chain-update.schema';
import { DeletedMultisigTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/deleted-multisig-transaction.schema';
import { ExecutedTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/executed-transaction.schema';
import { IncomingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-ether.schema';
import { IncomingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/incoming-token.schema';
import { MessageCreatedEventSchema } from '@/routes/cache-hooks/entities/schemas/message-created.schema';
import { ModuleTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/module-transaction.schema';
import { NewConfirmationEventSchema } from '@/routes/cache-hooks/entities/schemas/new-confirmation.schema';
import { NewMessageConfirmationEventSchema } from '@/routes/cache-hooks/entities/schemas/new-message-confirmation.schema';
import { OutgoingEtherEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-ether.schema';
import { OutgoingTokenEventSchema } from '@/routes/cache-hooks/entities/schemas/outgoing-token.schema';
import { PendingTransactionEventSchema } from '@/routes/cache-hooks/entities/schemas/pending-transaction.schema';
import { SafeAppsUpdateEventSchema } from '@/routes/cache-hooks/entities/schemas/safe-apps-update.schema';

export const WebHookSchema = z.discriminatedUnion('type', [
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
]);
