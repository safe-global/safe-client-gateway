// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import {
  getAllMultiSendDeployments,
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
} from '#/domain/common/utils/deployments';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  pendingTransactionOf,
  queuedCalls,
} from '#/modules/policies/routes/mappers/queued-calls.utils';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

const SEPOLIA_CHAIN_ID = '11155111';
// No MultiSend has ever been deployed here.
const CHAIN_ID_WITHOUT_MULTI_SEND = '4294967295';

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('queuedCalls', () => {
  const multiSendDecoder = new MultiSendDecoder(mockLoggingService);
  const chainId = SEPOLIA_CHAIN_ID;

  function randomData(): Hex {
    return faker.string.hexadecimal({ length: 72, casing: 'lower' }) as Hex;
  }

  function randomAddress(): Address {
    return getAddress(faker.finance.ethereumAddress());
  }

  /** A batch of one CALL and one DELEGATECALL, and the CALL it holds. */
  function aBatch(): { data: Hex; call: { to: Address; data: Hex } } {
    const call = { to: randomAddress(), data: randomData() };
    const data = multiSendEncoder()
      .with(
        'transactions',
        multiSendTransactionsEncoder([
          { operation: Operation.CALL, value: BigInt(0), ...call },
          {
            operation: Operation.DELEGATE,
            value: BigInt(0),
            to: randomAddress(),
            data: randomData(),
          },
        ]),
      )
      .encode();
    return { data, call };
  }

  function queued(args: {
    to: Address;
    operation: Operation;
    data: Hex | null;
  }): MultisigTransaction {
    return multisigTransactionBuilder()
      .with('to', args.to)
      .with('operation', args.operation)
      .with('data', args.data)
      .build();
  }

  it('should return the direct call', () => {
    const transaction = queued({
      to: randomAddress(),
      operation: Operation.CALL,
      data: randomData(),
    });

    expect(
      queuedCalls({ chainId, transaction, multiSendDecoder }),
    ).toStrictEqual([{ to: transaction.to, data: transaction.data }]);
  });

  it.each([
    ['MultiSend', getMultiSendDeployments],
    ['MultiSendCallOnly', getMultiSendCallOnlyDeployments],
  ])(
    'should return the CALLs of a batch delegatecalled to an official %s deployment, without its delegatecalls',
    (_, getDeployments) => {
      const { data, call } = aBatch();
      const transaction = queued({
        to: faker.helpers.arrayElement(
          getDeployments({ chainId, version: '1.4.1' }),
        ),
        operation: Operation.DELEGATE,
        data,
      });

      expect(
        queuedCalls({ chainId, transaction, multiSendDecoder }),
      ).toStrictEqual([call]);
    },
  );

  it('should not unpack a batch CALLed on MultiSend, as its calls run as MultiSend, not the Safe', () => {
    const { data } = aBatch();
    const transaction = queued({
      to: faker.helpers.arrayElement(getAllMultiSendDeployments({ chainId })),
      operation: Operation.CALL,
      data,
    });

    expect(
      queuedCalls({ chainId, transaction, multiSendDecoder }),
    ).toStrictEqual([{ to: transaction.to, data }]);
  });

  it('should not unpack multiSend calldata delegatecalled to a contract that is not an official MultiSend', () => {
    const { data } = aBatch();
    const transaction = queued({
      to: randomAddress(),
      operation: Operation.DELEGATE,
      data,
    });

    expect(
      queuedCalls({ chainId, transaction, multiSendDecoder }),
    ).toStrictEqual([]);
  });

  it('should not unpack a batch on a MultiSend deployment of another chain', () => {
    const { data } = aBatch();
    const transaction = queued({
      to: faker.helpers.arrayElement(getAllMultiSendDeployments({ chainId })),
      operation: Operation.DELEGATE,
      data,
    });

    expect(
      queuedCalls({
        chainId: CHAIN_ID_WITHOUT_MULTI_SEND,
        transaction,
        multiSendDecoder,
      }),
    ).toStrictEqual([]);
  });

  it('should return nothing for a transaction without data', () => {
    const transaction = queued({
      to: randomAddress(),
      operation: Operation.CALL,
      data: null,
    });

    expect(
      queuedCalls({ chainId, transaction, multiSendDecoder }),
    ).toStrictEqual([]);
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
      proposer: transaction.proposer,
    });
  });
});
