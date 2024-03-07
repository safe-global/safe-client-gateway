import { WebHookSchema } from '@/routes/cache-hooks/entities/schemas/web-hook.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('WebHookSchema', () => {
  const chainEvent = {
    type: 'CHAIN_UPDATE',
    chainId: faker.string.numeric(),
  };
  const deletedMultisigTransactionEvent = {
    type: 'DELETED_MULTISIG_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    safeTxHash: faker.string.hexadecimal(),
  };
  const executedTransactionEvent = {
    type: 'EXECUTED_MULTISIG_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    safeTxHash: faker.string.hexadecimal(),
    txHash: faker.string.hexadecimal(),
  };
  const incomingEtherEvent = {
    type: 'INCOMING_ETHER',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    txHash: faker.string.hexadecimal(),
    value: faker.string.numeric(),
  };
  const incomingTokenEvent = {
    type: 'INCOMING_TOKEN',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    tokenAddress: faker.finance.ethereumAddress(),
    txHash: faker.string.hexadecimal(),
  };
  const messageCreatedEvent = {
    type: 'MESSAGE_CREATED',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    messageHash: faker.string.hexadecimal(),
  };
  const moduleTransactionEvent = {
    type: 'MODULE_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    module: faker.finance.ethereumAddress(),
    txHash: faker.string.hexadecimal(),
  };
  const newConfirmationEvent = {
    type: 'NEW_CONFIRMATION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    owner: faker.finance.ethereumAddress(),
    safeTxHash: faker.string.hexadecimal(),
  };
  const newMessageConfirmationEvent = {
    type: 'MESSAGE_CONFIRMATION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    messageHash: faker.string.hexadecimal(),
  };
  const outgoingEtherEvent = {
    type: 'OUTGOING_ETHER',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    txHash: faker.string.hexadecimal(),
    value: faker.string.numeric(),
  };
  const outgoingTokenEvent = {
    type: 'OUTGOING_TOKEN',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    tokenAddress: faker.finance.ethereumAddress(),
    txHash: faker.string.hexadecimal(),
  };
  const pendingTransactionEvent = {
    type: 'PENDING_MULTISIG_TRANSACTION',
    address: faker.finance.ethereumAddress(),
    chainId: faker.string.numeric(),
    safeTxHash: faker.string.hexadecimal(),
  };
  const safeAppsEvent = {
    type: 'SAFE_APPS_UPDATE',
    chainId: faker.string.numeric(),
  };

  const events = [
    chainEvent,
    deletedMultisigTransactionEvent,
    executedTransactionEvent,
    incomingEtherEvent,
    incomingTokenEvent,
    messageCreatedEvent,
    moduleTransactionEvent,
    newConfirmationEvent,
    newMessageConfirmationEvent,
    outgoingEtherEvent,
    outgoingTokenEvent,
    pendingTransactionEvent,
    safeAppsEvent,
  ];

  it.each(events.map((event) => [event.type, event]))(
    'should validate a %s event',
    (_, event) => {
      const result = WebHookSchema.safeParse(event);

      expect(result.success).toBe(true);
    },
  );

  it('should not allow an invalid event', () => {
    const invalidEvent = {
      type: 'INVALID_EVENT',
    };

    const result = WebHookSchema.safeParse(invalidEvent);

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
          ],
          path: ['type'],
          message:
            "Invalid discriminator value. Expected 'CHAIN_UPDATE' | 'DELETED_MULTISIG_TRANSACTION' | 'EXECUTED_MULTISIG_TRANSACTION' | 'INCOMING_ETHER' | 'INCOMING_TOKEN' | 'MESSAGE_CREATED' | 'MODULE_TRANSACTION' | 'NEW_CONFIRMATION' | 'MESSAGE_CONFIRMATION' | 'OUTGOING_ETHER' | 'OUTGOING_TOKEN' | 'PENDING_MULTISIG_TRANSACTION' | 'SAFE_APPS_UPDATE'",
        },
      ]),
    );
  });
});
