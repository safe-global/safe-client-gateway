import { JSONSchemaType } from 'ajv';
import { ExecutedTransaction } from '../executed-transaction.entity';
import { NewConfirmation } from '../new-confirmation.entity';
import { PendingTransaction } from '../pending-transaction.entity';
import { IncomingToken } from '../incoming-token.entity';
import { OutgoingToken } from '../outgoing-token.entity';
import { IncomingEther } from '../incoming-ether.entity';
import { OutgoingEther } from '../outgoing-ether.entity';

export const webHookSchema: JSONSchemaType<
  | ExecutedTransaction
  | NewConfirmation
  | PendingTransaction
  | IncomingToken
  | OutgoingToken
  | IncomingEther
  | OutgoingEther
> = {
  $id: 'https://safe-client.safe.global/schemas/cache-hooks/web-hook.json',
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
