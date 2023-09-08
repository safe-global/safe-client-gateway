import { JSONSchemaType } from 'ajv';
import { ExecutedTransaction } from '../executed-transaction.entity';
import { NewConfirmation } from '../new-confirmation.entity';
import { PendingTransaction } from '../pending-transaction.entity';
import { IncomingToken } from '../incoming-token.entity';
import { OutgoingToken } from '../outgoing-token.entity';
import { IncomingEther } from '../incoming-ether.entity';
import { OutgoingEther } from '../outgoing-ether.entity';
import { ModuleTransaction } from '../module-transaction.entity';
import { MessageCreated } from '../message-created.entity';
import { NewMessageConfirmation } from '../new-message-confirmation.entity';
import { ChainUpdate } from '@/routes/cache-hooks/entities/chain-update.entity';
import { SafeAppsUpdate } from '@/routes/cache-hooks/entities/safe-apps-update.entity';

export const WEB_HOOK_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/web-hook.json';

export const webHookSchema: JSONSchemaType<
  | ChainUpdate
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
