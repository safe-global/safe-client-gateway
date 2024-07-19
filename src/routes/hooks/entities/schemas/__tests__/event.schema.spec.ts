import { chainUpdateEventBuilder } from '@/routes/hooks/entities/__tests__/chain-update.builder';
import { deletedMultisigTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/executed-transaction.builder';
import { incomingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/incoming-token.builder';
import { messageCreatedEventBuilder } from '@/routes/hooks/entities/__tests__/message-created.builder';
import { moduleTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/module-transaction.builder';
import { newConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-confirmation.builder';
import { newMessageConfirmationEventBuilder } from '@/routes/hooks/entities/__tests__/new-message-confirmation.builder';
import { outgoingEtherEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-ether.builder';
import { outgoingTokenEventBuilder } from '@/routes/hooks/entities/__tests__/outgoing-token.builder';
import { pendingTransactionEventBuilder } from '@/routes/hooks/entities/__tests__/pending-transaction.builder';
import { safeAppsEventBuilder } from '@/routes/hooks/entities/__tests__/safe-apps-update.builder';
import { EventSchema } from '@/routes/hooks/entities/schemas/event.schema';
import { ZodError } from 'zod';

describe('EventSchema', () => {
  [
    chainUpdateEventBuilder,
    deletedMultisigTransactionEventBuilder,
    executedTransactionEventBuilder,
    incomingEtherEventBuilder,
    incomingTokenEventBuilder,
    messageCreatedEventBuilder,
    moduleTransactionEventBuilder,
    newConfirmationEventBuilder,
    newMessageConfirmationEventBuilder,
    outgoingEtherEventBuilder,
    outgoingTokenEventBuilder,
    pendingTransactionEventBuilder,
    safeAppsEventBuilder,
  ].forEach((builder) => {
    const event = builder().build();

    it(`should validate a ${event.type} event`, () => {
      const result = EventSchema.safeParse(event);

      expect(result.success).toBe(true);
    });
  });

  it('should not allow an invalid event', () => {
    const invalidEvent = {
      type: 'INVALID_EVENT',
    };

    const result = EventSchema.safeParse(invalidEvent);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_union_discriminator',
          options: [
            'CHAIN_UPDATE',
            'DELETED_MULTISIG_TRANSACTION',
            'EXECUTED_MULTISIG_TRANSACTION',
            'INCOMING_ETHER',
            'INCOMING_TOKEN',
            'MESSAGE_CREATED',
            'MODULE_TRANSACTION',
            'NEW_CONFIRMATION',
            'MESSAGE_CONFIRMATION',
            'OUTGOING_ETHER',
            'OUTGOING_TOKEN',
            'PENDING_MULTISIG_TRANSACTION',
            'SAFE_APPS_UPDATE',
            'SAFE_CREATED',
          ],
          path: ['type'],
          message:
            "Invalid discriminator value. Expected 'CHAIN_UPDATE' | 'DELETED_MULTISIG_TRANSACTION' | 'EXECUTED_MULTISIG_TRANSACTION' | 'INCOMING_ETHER' | 'INCOMING_TOKEN' | 'MESSAGE_CREATED' | 'MODULE_TRANSACTION' | 'NEW_CONFIRMATION' | 'MESSAGE_CONFIRMATION' | 'OUTGOING_ETHER' | 'OUTGOING_TOKEN' | 'PENDING_MULTISIG_TRANSACTION' | 'SAFE_APPS_UPDATE' | 'SAFE_CREATED'",
        },
      ]),
    );
  });
});
