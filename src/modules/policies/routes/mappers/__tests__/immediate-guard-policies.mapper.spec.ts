// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex } from 'viem';
import type { MockedObject } from 'vitest';
import { getAllMultiSendDeployments } from '#/domain/common/utils/deployments';
import type { ILoggingService } from '#/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '#/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { setGuardEncoder } from '#/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '#/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  configureImmediatelyEncoder,
  requestConfigurationEncoder,
} from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafePolicyGuardDecoder } from '#/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { ImmediateGuardPoliciesMapper } from '#/modules/policies/routes/mappers/immediate-guard-policies.mapper';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

const mockLoggingService = {
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA_CHAIN_ID = '11155111';

describe('ImmediateGuardPoliciesMapper', () => {
  let target: ImmediateGuardPoliciesMapper;
  const safe = {
    chainId: SEPOLIA_CHAIN_ID,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const [guard] = getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);

  beforeEach(() => {
    vi.resetAllMocks();
    target = new ImmediateGuardPoliciesMapper(
      new MultiSendDecoder(mockLoggingService),
      new SafePolicyGuardDecoder(),
      mockLoggingService,
    );
  });

  /** A queued transaction with `confirmations` of 2 signatures. */
  function queued(args: {
    to: Address;
    data: Hex;
    confirmations?: number;
    operation?: Operation;
  }): MultisigTransaction {
    return multisigTransactionBuilder()
      .with('to', args.to)
      .with('operation', args.operation ?? Operation.CALL)
      .with('data', args.data)
      .with('confirmationsRequired', 2)
      .with(
        'confirmations',
        Array.from({ length: args.confirmations ?? 1 }, () =>
          confirmationBuilder().build(),
        ),
      )
      .build();
  }

  it('should report a configureImmediately on a known guard while it is being signed', () => {
    const configureImmediately = configureImmediatelyEncoder();
    const transaction = queued({
      to: guard,
      data: configureImmediately.encode(),
    });

    expect(target.map({ safe, transactions: [transaction] })).toStrictEqual([
      {
        kind: 'immediate-guard-policies',
        status: 'in-signing',
        safe,
        guard,
        configurations: configureImmediately.build().configurations,
        transaction: {
          safeTxHash: transaction.safeTxHash,
          nonce: transaction.nonce,
          confirmations: 1,
          confirmationsRequired: 2,
          proposedAt: Math.floor(transaction.submissionDate.getTime() / 1000),
          proposer: transaction.proposer,
        },
      },
    ]);
  });

  it('should report a fully signed configureImmediately as ready', () => {
    const transaction = queued({
      to: guard,
      data: configureImmediatelyEncoder().encode(),
      confirmations: 2,
    });

    const [item] = target.map({ safe, transactions: [transaction] });

    expect(item.status).toBe('ready');
  });

  it('should find a configureImmediately inside a MultiSend batch', () => {
    const configureImmediately = configureImmediatelyEncoder();
    const batch = multiSendEncoder()
      .with(
        'transactions',
        multiSendTransactionsEncoder([
          {
            operation: Operation.CALL,
            to: guard,
            value: BigInt(0),
            data: configureImmediately.encode(),
          },
          {
            operation: Operation.CALL,
            to: safe.address,
            value: BigInt(0),
            data: setGuardEncoder().with('guard', guard).encode(),
          },
        ]),
      )
      .encode();
    const transaction = queued({
      to: faker.helpers.arrayElement(
        getAllMultiSendDeployments({ chainId: SEPOLIA_CHAIN_ID }),
      ),
      operation: Operation.DELEGATE,
      data: batch,
    });

    expect(target.map({ safe, transactions: [transaction] })).toStrictEqual([
      expect.objectContaining({
        kind: 'immediate-guard-policies',
        guard,
        configurations: configureImmediately.build().configurations,
      }),
    ]);
  });

  it('should ignore configureImmediately on an unknown contract', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: configureImmediatelyEncoder().encode(),
    });

    expect(target.map({ safe, transactions: [transaction] })).toStrictEqual([]);
  });

  it('should ignore other calls to the guard', () => {
    const transaction = queued({
      to: guard,
      data: requestConfigurationEncoder().encode(),
    });

    expect(target.map({ safe, transactions: [transaction] })).toStrictEqual([]);
  });

  it('should skip and log a configureImmediately whose arguments do not decode', () => {
    const valid = configureImmediatelyEncoder().encode();
    // The selector matches, the arguments are cut short.
    const truncated: Hex = `0x${valid.slice(2, 74)}`;
    const transaction = queued({ to: guard, data: truncated });

    expect(target.map({ safe, transactions: [transaction] })).toStrictEqual([]);
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not decode a queued configureImmediately call',
        chainId: safe.chainId,
        safeTxHash: transaction.safeTxHash,
      }),
    );
  });
});
