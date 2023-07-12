import { JSONSchemaType } from 'ajv';
import { ExecutedTransaction } from '../executed-transaction.entity';
import { NewConfirmation } from '../new-confirmation.entity';
import { PendingTransaction } from '../pending-transaction.entity';
import { IncomingToken } from '../incoming-token.entity';
import { OutgoingToken } from '../outgoing-token.entity';
import { IncomingEther } from '../incoming-ether.entity';
import { OutgoingEther } from '../outgoing-ether.entity';
import { ModuleTransaction } from '../module-transaction.entity';

export const WEB_HOOK_SCHEMA_ID =
  'https://safe-client.safe.global/schemas/cache-hooks/web-hook.json';

export const webHookSchema: JSONSchemaType<
  | ExecutedTransaction
  | IncomingEther
  | IncomingToken
  | ModuleTransaction
  | NewConfirmation
  | OutgoingToken
  | OutgoingEther
  | PendingTransaction
> = {
  $id: WEB_HOOK_SCHEMA_ID,
  type: 'object',
  discriminator: { propertyName: 'type' },
  required: ['type', 'address', 'chainId'],
  oneOf: [
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
      $ref: 'module-transaction.json',
    },
    {
      $ref: 'new-confirmation.json',
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
  ],
};
