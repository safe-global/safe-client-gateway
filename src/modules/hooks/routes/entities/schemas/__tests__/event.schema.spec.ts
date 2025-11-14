import { chainUpdateEventBuilder } from '@/modules/hooks/routes/entities/__tests__/chain-update.builder';
import {
  deletedDelegateEventBuilder,
  newDelegateEventBuilder,
  updatedDelegateEventBuilder,
} from '@/modules/hooks/routes/entities/__tests__/delegate-events.builder';
import { deletedMultisigTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/deleted-multisig-transaction.builder';
import { executedTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/executed-transaction.builder';
import { incomingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-ether.builder';
import { incomingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/incoming-token.builder';
import { messageCreatedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/message-created.builder';
import { moduleTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/module-transaction.builder';
import { newConfirmationEventBuilder } from '@/modules/hooks/routes/entities/__tests__/new-confirmation.builder';
import { newMessageConfirmationEventBuilder } from '@/modules/hooks/routes/entities/__tests__/new-message-confirmation.builder';
import { outgoingEtherEventBuilder } from '@/modules/hooks/routes/entities/__tests__/outgoing-ether.builder';
import { outgoingTokenEventBuilder } from '@/modules/hooks/routes/entities/__tests__/outgoing-token.builder';
import { pendingTransactionEventBuilder } from '@/modules/hooks/routes/entities/__tests__/pending-transaction.builder';
import { reorgDetectedEventBuilder } from '@/modules/hooks/routes/entities/__tests__/reorg-detected.builder';
import { safeAppsEventBuilder } from '@/modules/hooks/routes/entities/__tests__/safe-apps-update.builder';
import { EventSchema } from '@/modules/hooks/routes/entities/schemas/event.schema';
import { ZodError } from 'zod';

describe('EventSchema', () => {
  [
    chainUpdateEventBuilder,
    deletedDelegateEventBuilder,
    deletedMultisigTransactionEventBuilder,
    executedTransactionEventBuilder,
    incomingEtherEventBuilder,
    incomingTokenEventBuilder,
    messageCreatedEventBuilder,
    moduleTransactionEventBuilder,
    newConfirmationEventBuilder,
    newDelegateEventBuilder,
    newMessageConfirmationEventBuilder,
    outgoingEtherEventBuilder,
    outgoingTokenEventBuilder,
    pendingTransactionEventBuilder,
    reorgDetectedEventBuilder,
    safeAppsEventBuilder,
    updatedDelegateEventBuilder,
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
            'DELETED_DELEGATE',
            'INCOMING_ETHER',
            'INCOMING_TOKEN',
            'MESSAGE_CREATED',
            'MODULE_TRANSACTION',
            'NEW_DELEGATE',
            'NEW_CONFIRMATION',
            'MESSAGE_CONFIRMATION',
            'OUTGOING_ETHER',
            'OUTGOING_TOKEN',
            'PENDING_MULTISIG_TRANSACTION',
            'REORG_DETECTED',
            'SAFE_APPS_UPDATE',
            'SAFE_CREATED',
            'UPDATED_DELEGATE',
          ],
          path: ['type'],
          message:
            "Invalid discriminator value. Expected 'CHAIN_UPDATE' | 'DELETED_MULTISIG_TRANSACTION' | 'EXECUTED_MULTISIG_TRANSACTION' | 'DELETED_DELEGATE' | 'INCOMING_ETHER' | 'INCOMING_TOKEN' | 'MESSAGE_CREATED' | 'MODULE_TRANSACTION' | 'NEW_DELEGATE' | 'NEW_CONFIRMATION' | 'MESSAGE_CONFIRMATION' | 'OUTGOING_ETHER' | 'OUTGOING_TOKEN' | 'PENDING_MULTISIG_TRANSACTION' | 'REORG_DETECTED' | 'SAFE_APPS_UPDATE' | 'SAFE_CREATED' | 'UPDATED_DELEGATE'",
        },
      ]),
    );
  });
});
