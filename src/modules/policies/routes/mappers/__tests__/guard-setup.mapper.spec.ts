// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { setGuardEncoder } from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import {
  configureImmediatelyEncoder,
  requestConfigurationEncoder,
  setModuleGuardEncoder,
} from '@/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafeGuardManagerDecoder } from '@/modules/policies/domain/contracts/decoders/safe-guard-manager-decoder.helper';
import { SafePolicyGuardDecoder } from '@/modules/policies/domain/contracts/decoders/safe-policy-guard-decoder.helper';
import { getSafePolicyGuardDeployments } from '@/modules/policies/domain/policy-deployments.constants';
import { GuardSetupMapper } from '@/modules/policies/routes/mappers/guard-setup.mapper';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const mockLoggingService = {
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA_CHAIN_ID = '11155111';

describe('GuardSetupMapper', () => {
  let target: GuardSetupMapper;
  const safe = {
    chainId: SEPOLIA_CHAIN_ID,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const [guard] = getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);

  beforeEach(() => {
    target = new GuardSetupMapper(
      new MultiSendDecoder(mockLoggingService),
      new SafePolicyGuardDecoder(),
      new SafeGuardManagerDecoder(),
      mockLoggingService,
    );
  });

  /** A queued transaction with `confirmations` of `required` signatures. */
  function queued(args: {
    to: Address;
    data: Hex;
    confirmations?: number;
    required?: number;
  }): MultisigTransaction {
    const required = args.required ?? 2;
    return multisigTransactionBuilder()
      .with('to', args.to)
      .with('operation', Operation.CALL)
      .with('data', args.data)
      .with('confirmationsRequired', required)
      .with(
        'confirmations',
        Array.from({ length: args.confirmations ?? 1 }, () =>
          confirmationBuilder().build(),
        ),
      )
      .build();
  }

  /** A MultiSend batch of `calls`, all `CALL`s. */
  function batch(calls: Array<{ to: Address; data: Hex }>): Hex {
    return multiSendEncoder()
      .with(
        'transactions',
        multiSendTransactionsEncoder(
          calls.map((call) => ({
            operation: Operation.CALL,
            to: call.to,
            value: BigInt(0),
            data: call.data,
          })),
        ),
      )
      .encode();
  }

  function map(args: {
    transactions: Array<MultisigTransaction>;
    guard?: Address | null;
    moduleGuard?: Address | null;
  }): ReturnType<GuardSetupMapper['map']> {
    return target.map({
      safe,
      guard: args.guard ?? null,
      moduleGuard: args.moduleGuard ?? null,
      transactions: args.transactions,
    });
  }

  it('should report a setup batch in calldata order while it is being signed', () => {
    const configureImmediately = configureImmediatelyEncoder();
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: batch([
        { to: guard, data: configureImmediately.encode() },
        {
          to: safe.address,
          data: setGuardEncoder().with('guard', guard).encode(),
        },
        {
          to: safe.address,
          data: setModuleGuardEncoder().with('moduleGuard', guard).encode(),
        },
      ]),
      confirmations: 1,
      required: 2,
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([
      {
        kind: 'guard-setup',
        status: 'setup-in-signing',
        safe,
        changes: [
          {
            kind: 'configure-immediately',
            guard,
            configurations: configureImmediately.build().configurations,
            willRevert: false,
          },
          { kind: 'set-guard', from: null, to: guard },
          { kind: 'set-module-guard', from: null, to: guard },
        ],
        transaction: {
          safeTxHash: transaction.safeTxHash,
          nonce: transaction.nonce,
          confirmations: 1,
          confirmationsRequired: 2,
          proposedAt: Math.floor(transaction.submissionDate.getTime() / 1000),
        },
      },
    ]);
  });

  it('should report a fully signed setup transaction as ready', () => {
    const transaction = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', guard).encode(),
      confirmations: 2,
      required: 2,
    });

    const [item] = map({ transactions: [transaction] });

    expect(item.status).toBe('setup-ready');
  });

  it('should flag configureImmediately after setGuard in the same batch as reverting', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: batch([
        {
          to: safe.address,
          data: setGuardEncoder().with('guard', guard).encode(),
        },
        { to: guard, data: configureImmediatelyEncoder().encode() },
      ]),
    });

    const [item] = map({ transactions: [transaction] });

    expect(item.changes[1]).toStrictEqual(
      expect.objectContaining({
        kind: 'configure-immediately',
        willRevert: true,
      }),
    );
  });

  it('should flag configureImmediately as reverting when the guard is already the module guard', () => {
    const transaction = queued({
      to: guard,
      data: configureImmediatelyEncoder().encode(),
    });

    const [item] = map({ transactions: [transaction], moduleGuard: guard });

    expect(item.changes).toStrictEqual([
      expect.objectContaining({ willRevert: true }),
    ]);
  });

  it('should report removing the guard', () => {
    const transaction = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', zeroAddress).encode(),
    });

    const [item] = map({ transactions: [transaction], guard });

    expect(item.changes).toStrictEqual([
      { kind: 'set-guard', from: guard, to: null },
    ]);
  });

  it('should ignore a guard change that involves no SafePolicyGuard', () => {
    const transaction = queued({
      to: safe.address,
      data: setGuardEncoder()
        .with('guard', getAddress(faker.finance.ethereumAddress()))
        .encode(),
    });

    expect(
      map({
        transactions: [transaction],
        guard: getAddress(faker.finance.ethereumAddress()),
      }),
    ).toStrictEqual([]);
  });

  it('should treat a zero-address guard as no guard', () => {
    const transaction = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', guard).encode(),
    });

    const [item] = map({
      transactions: [transaction],
      guard: zeroAddress,
      moduleGuard: zeroAddress,
    });

    expect(item.changes).toStrictEqual([
      { kind: 'set-guard', from: null, to: guard },
    ]);
  });

  it('should report only the setup calls of a batch that also requests a configuration', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: batch([
        {
          to: safe.address,
          data: setGuardEncoder().with('guard', guard).encode(),
        },
        { to: guard, data: requestConfigurationEncoder().encode() },
      ]),
    });

    const [item] = map({ transactions: [transaction] });

    expect(item.changes).toStrictEqual([
      { kind: 'set-guard', from: null, to: guard },
    ]);
  });

  it('should ignore configureImmediately on an unknown contract', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: configureImmediatelyEncoder().encode(),
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should ignore a delegatecall', () => {
    const transaction = multisigTransactionBuilder()
      .with('to', guard)
      .with('operation', Operation.DELEGATE)
      .with('data', configureImmediatelyEncoder().encode())
      .build();

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should ignore undecodable data', () => {
    const transaction = queued({
      to: guard,
      data: faker.string.hexadecimal({ length: 64 }) as Hex,
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should judge each queued transaction against the current guards', () => {
    // An earlier queued transaction may never execute, so it does not change
    // what a later one runs against.
    const setGuard = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', guard).encode(),
    });
    const configureImmediately = queued({
      to: guard,
      data: configureImmediatelyEncoder().encode(),
    });

    const [, item] = map({ transactions: [setGuard, configureImmediately] });

    expect(item.changes).toStrictEqual([
      expect.objectContaining({ willRevert: false }),
    ]);
  });
});
