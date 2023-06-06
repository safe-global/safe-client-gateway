import { JSONSchemaType } from 'ajv';
import { ExecutedTransaction } from '../executed-transaction.entity';
import { NewConfirmation } from '../new-confirmation.entity';
import { PendingTransaction } from '../pending-transaction.entity';

export const webHookSchema: JSONSchemaType<
  ExecutedTransaction | NewConfirmation | PendingTransaction
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
      $ref: 'new-confirmation.json',
    },
    {
      $ref: 'pending-transaction.json',
    },
  ],
};
