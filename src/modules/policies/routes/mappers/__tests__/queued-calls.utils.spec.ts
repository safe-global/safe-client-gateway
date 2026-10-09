// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  pendingTransactionOf,
  queuedCalls,
} from '@/modules/policies/routes/mappers/queued-calls.utils';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('queuedCalls', () => {
  const multiSendDecoder = new MultiSendDecoder(mockLoggingService);

  function randomData(): Hex {
    return faker.string.hexadecimal({ length: 72, casing: 'lower' }) as Hex;
  }

  it('should return the direct call', () => {
    const transaction = multisigTransactionBuilder()
      .with('operation', Operation.CALL)
      .with('data', randomData())
      .build();

    expect(queuedCalls(transaction, multiSendDecoder)).toStrictEqual([
      { to: transaction.to, data: transaction.data },
    ]);
  });

  it('should add the CALLs of a MultiSend batch, without its delegatecalls', () => {
    const call = {
      to: getAddress(faker.finance.ethereumAddress()),
      data: randomData(),
    };
    const data = multiSendEncoder()
      .with(
        'transactions',
        multiSendTransactionsEncoder([
          { operation: Operation.CALL, value: BigInt(0), ...call },
          {
            operation: Operation.DELEGATE,
            value: BigInt(0),
            to: getAddress(faker.finance.ethereumAddress()),
            data: randomData(),
          },
        ]),
      )
      .encode();
    const transaction = multisigTransactionBuilder()
      .with('operation', Operation.CALL)
      .with('data', data)
      .build();

    expect(queuedCalls(transaction, multiSendDecoder)).toStrictEqual([
      { to: transaction.to, data },
      call,
    ]);
  });

  it('should return nothing for a transaction without data', () => {
    const transaction = multisigTransactionBuilder().with('data', null).build();

    expect(queuedCalls(transaction, multiSendDecoder)).toStrictEqual([]);
  });
});

describe('pendingTransactionOf', () => {
  it('should report the signing state of a queued transaction', () => {
    const confirmations = faker.helpers.multiple(
      () => confirmationBuilder().build(),
      { count: { min: 1, max: 3 } },
    );
    const transaction = multisigTransactionBuilder()
      .with('confirmations', confirmations)
      .build();

    expect(pendingTransactionOf(transaction)).toStrictEqual({
      safeTxHash: transaction.safeTxHash,
      nonce: transaction.nonce,
      confirmations: confirmations.length,
      confirmationsRequired: transaction.confirmationsRequired,
      proposedAt: Math.floor(transaction.submissionDate.getTime() / 1000),
    });
  });
});
