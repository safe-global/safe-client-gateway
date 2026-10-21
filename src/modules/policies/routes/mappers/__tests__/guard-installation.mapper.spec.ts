// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress, type Hex, zeroAddress } from 'viem';
import type { MockedObject } from 'vitest';
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
  setModuleGuardEncoder,
} from '#/modules/policies/domain/contracts/__tests__/encoders/safe-policy-guard-encoder.builder';
import { SafeGuardManagerDecoder } from '#/modules/policies/domain/contracts/decoders/safe-guard-manager-decoder.helper';
import { getSafePolicyGuardDeployments } from '#/modules/policies/domain/policy-deployments.constants';
import { GuardInstallationMapper } from '#/modules/policies/routes/mappers/guard-installation.mapper';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { Operation } from '#/modules/safe/domain/entities/operation.entity';

const mockLoggingService = {
  warn: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const SEPOLIA_CHAIN_ID = '11155111';

describe('GuardInstallationMapper', () => {
  let target: GuardInstallationMapper;
  const safe = {
    chainId: SEPOLIA_CHAIN_ID,
    address: getAddress(faker.finance.ethereumAddress()),
  };
  const [guard, otherGuard] = getSafePolicyGuardDeployments(SEPOLIA_CHAIN_ID);

  beforeEach(() => {
    target = new GuardInstallationMapper(
      new MultiSendDecoder(mockLoggingService),
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
  }): ReturnType<GuardInstallationMapper['map']> {
    return target.map({
      safe,
      guard: args.guard ?? null,
      moduleGuard: args.moduleGuard ?? null,
      transactions: args.transactions,
    });
  }

  it('should report a setup batch in calldata order while it is being signed', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: batch([
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
        kind: 'guard-installation',
        status: 'in-signing',
        safe,
        changes: [
          { kind: 'set-guard', from: null, to: guard },
          { kind: 'set-module-guard', from: null, to: guard },
        ],
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

  it('should report a fully signed setup transaction as ready', () => {
    const transaction = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', guard).encode(),
      confirmations: 2,
      required: 2,
    });

    const [item] = map({ transactions: [transaction] });

    expect(item.status).toBe('ready');
  });

  it('should carry the guard slot through the calls of a batch', () => {
    const transaction = queued({
      to: getAddress(faker.finance.ethereumAddress()),
      data: batch([
        {
          to: safe.address,
          data: setGuardEncoder().with('guard', guard).encode(),
        },
        {
          to: safe.address,
          data: setGuardEncoder().with('guard', otherGuard).encode(),
        },
      ]),
    });

    const [item] = map({ transactions: [transaction] });

    expect(item.changes).toStrictEqual([
      { kind: 'set-guard', from: null, to: guard },
      { kind: 'set-guard', from: guard, to: otherGuard },
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

  it('should ignore configureImmediately, which sets up policies, not the guard', () => {
    const transaction = queued({
      to: guard,
      data: configureImmediatelyEncoder().encode(),
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should ignore a delegatecall', () => {
    const transaction = multisigTransactionBuilder()
      .with('to', safe.address)
      .with('operation', Operation.DELEGATE)
      .with('data', setGuardEncoder().with('guard', guard).encode())
      .build();

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should ignore undecodable data', () => {
    const transaction = queued({
      to: safe.address,
      data: faker.string.hexadecimal({ length: 64 }) as Hex,
    });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
  });

  it('should skip and log a guard setter whose arguments do not decode', () => {
    const valid = setGuardEncoder().with('guard', guard).encode();
    // The selector matches, the arguments are cut short.
    const truncated: Hex = `0x${valid.slice(2, 42)}`;

    const transaction = queued({ to: safe.address, data: truncated });

    expect(map({ transactions: [transaction] })).toStrictEqual([]);
    expect(mockLoggingService.debug).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Could not decode a queued guard setter call',
        chainId: safe.chainId,
        safeTxHash: transaction.safeTxHash,
      }),
    );
  });

  it('should judge each queued transaction against the current guards', () => {
    // An earlier queued transaction may never execute, so it does not change
    // what a later one runs against.
    const removeGuard = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', zeroAddress).encode(),
    });
    const replaceGuard = queued({
      to: safe.address,
      data: setGuardEncoder().with('guard', otherGuard).encode(),
    });

    const [, item] = map({
      transactions: [removeGuard, replaceGuard],
      guard,
    });

    expect(item.changes).toStrictEqual([
      { kind: 'set-guard', from: guard, to: otherGuard },
    ]);
  });
});
