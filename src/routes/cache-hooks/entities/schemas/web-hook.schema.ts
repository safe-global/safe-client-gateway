import { JSONSchemaType } from 'ajv';
import { ChainUpdate } from '@/routes/cache-hooks/entities/chain-update.entity';
import { ExecutedTransaction } from '@/routes/cache-hooks/entities/executed-transaction.entity';
import { IncomingEther } from '@/routes/cache-hooks/entities/incoming-ether.entity';
import { IncomingToken } from '@/routes/cache-hooks/entities/incoming-token.entity';
import { MessageCreated } from '@/routes/cache-hooks/entities/message-created.entity';
import { ModuleTransaction } from '@/routes/cache-hooks/entities/module-transaction.entity';
import { NewConfirmation } from '@/routes/cache-hooks/entities/new-confirmation.entity';
import { NewMessageConfirmation } from '@/routes/cache-hooks/entities/new-message-confirmation.entity';
import { OutgoingEther } from '@/routes/cache-hooks/entities/outgoing-ether.entity';
import { OutgoingToken } from '@/routes/cache-hooks/entities/outgoing-token.entity';
import { PendingTransaction } from '@/routes/cache-hooks/entities/pending-transaction.entity';
import { SafeAppsUpdate } from '@/routes/cache-hooks/entities/safe-apps-update.entity';
import { DeletedMultisigTransaction } from '@/routes/cache-hooks/entities/deleted-multisig-transaction.entity';

export const WEB_HOOK_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/web-hook.json';

export const webHookSchema: JSONSchemaType<
  | ChainUpdate
  | DeletedMultisigTransaction
  | ExecutedTransaction
  | IncomingEther
  | IncomingToken
  | MessageCreated
  | ModuleTransaction
  | NewConfirmation
  | NewMessageConfirmation
  | OutgoingToken
  | OutgoingEther
  | PendingTransaction
  | SafeAppsUpdate
> = {
  $id: WEB_HOOK_SCHEMA_ID,
  type: 'object',
  discriminator: { propertyName: 'type' },
  required: ['type', 'chainId'],
  oneOf: [
    {
      $ref: 'chain-update.json',
    },
    {
      $ref: 'deleted-multisig-transaction.json',
    },
    {
      $ref: 'executed-transaction.json',
    },
    {
      $ref: 'incoming-ether.json',
    },
    {
      $ref: 'incoming-token.json',
    },
    {
      $ref: 'message-created.json',
    },
    {
      $ref: 'module-transaction.json',
    },
    {
      $ref: 'new-confirmation.json',
    },
    {
      $ref: 'new-message-confirmation.json',
    },
    {
      $ref: 'outgoing-ether.json',
    },
    {
      $ref: 'outgoing-token.json',
    },
    {
      $ref: 'pending-transaction.json',
    },
    {
      $ref: 'safe-apps-update.json',
    },
  ],
};
