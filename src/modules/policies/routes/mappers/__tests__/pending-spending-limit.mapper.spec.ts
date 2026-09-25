// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  addDelegateEncoder,
  setAllowanceEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/allowance-module-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { enableModuleEncoder } from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { AllowanceModuleDecoder } from '@/modules/contracts/domain/decoders/allowance-module-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { PendingSpendingLimitMapper } from '@/modules/policies/routes/mappers/pending-spending-limit.mapper';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

// Sepolia's only Allowance Module deployment (v0.1.0), per @safe-global/safe-modules-deployments.
const SEPOLIA_CHAIN_ID = '11155111';
const SEPOLIA_ALLOWANCE_MODULE = getAddress(
  '0xCFbFaC74C26F8647cBDb8c5caf80BB5b32E43134',
);
// No Allowance Module has ever been deployed here.
const CHAIN_ID_WITHOUT_ALLOWANCE_MODULE = '999999999';

const mockLoggingService = {
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('PendingSpendingLimitMapper', () => {
  let target: PendingSpendingLimitMapper;

  beforeEach(() => {
    vi.resetAllMocks();
    target = new PendingSpendingLimitMapper(
      new MultiSendDecoder(mockLoggingService),
      new SafeDecoder(),
      new AllowanceModuleDecoder(),
    );
  });

  it('returns nothing on a chain with no known Allowance Module deployment', () => {
    const safe = {
      chainId: CHAIN_ID_WITHOUT_ALLOWANCE_MODULE,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const transaction = multisigTransactionBuilder()
      .with('to', SEPOLIA_ALLOWANCE_MODULE)
      .with('operation', Operation.CALL)
      .with('data', setAllowanceEncoder().encode())
      .build();

    expect(target.map({ safe, transactions: [transaction] })).toEqual([]);
  });

  it('detects a direct setAllowance call', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const setAllowance = setAllowanceEncoder();
    const setAllowanceArgs = setAllowance.build();
    const transaction = multisigTransactionBuilder()
      .with('to', SEPOLIA_ALLOWANCE_MODULE)
      .with('operation', Operation.CALL)
      .with('data', setAllowance.encode())
      .build();

    const result = target.map({ safe, transactions: [transaction] });

    expect(result).toEqual([
      {
        kind: 'queued-transaction',
        type: 'spending-limit',
        enforcement: { via: 'module', moduleAddress: SEPOLIA_ALLOWANCE_MODULE },
        safeTxHash: transaction.safeTxHash,
        nonce: transaction.nonce,
        confirmations: transaction.confirmations?.length ?? 0,
        confirmationsRequired: transaction.confirmationsRequired,
        proposedAt: Math.floor(transaction.submissionDate.getTime() / 1000),
        data: {
          module: SEPOLIA_ALLOWANCE_MODULE,
          changes: [
            {
              kind: 'set-allowance',
              operation: 'update',
              delegate: setAllowanceArgs.delegate,
              token: setAllowanceArgs.token,
              amount: setAllowanceArgs.allowanceAmount.toString(),
              resetPeriodMinutes: setAllowanceArgs.resetTimeMin,
            },
          ],
        },
        safe,
      },
    ]);
  });

  it('bundles two changes found in one MultiSend batch into a single item', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const addDelegate = addDelegateEncoder();
    const setAllowance = setAllowanceEncoder();
    const addDelegateArgs = addDelegate.build();
    const setAllowanceArgs = setAllowance.build();

    const batchedTransactions = multiSendTransactionsEncoder([
      {
        operation: Operation.CALL,
        to: SEPOLIA_ALLOWANCE_MODULE,
        value: BigInt(0),
        data: addDelegate.encode(),
      },
      {
        operation: Operation.CALL,
        to: SEPOLIA_ALLOWANCE_MODULE,
        value: BigInt(0),
        data: setAllowance.encode(),
      },
    ]);
    const data = multiSendEncoder()
      .with('transactions', batchedTransactions)
      .encode();
    const transaction = multisigTransactionBuilder()
      .with('to', getAddress(faker.finance.ethereumAddress()))
      .with('operation', Operation.CALL)
      .with('data', data)
      .build();

    const result = target.map({ safe, transactions: [transaction] });

    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual({
      module: SEPOLIA_ALLOWANCE_MODULE,
      changes: [
        {
          kind: 'add-delegate',
          operation: 'create',
          delegate: addDelegateArgs.delegate,
        },
        {
          kind: 'set-allowance',
          operation: 'update',
          delegate: setAllowanceArgs.delegate,
          token: setAllowanceArgs.token,
          amount: setAllowanceArgs.allowanceAmount.toString(),
          resetPeriodMinutes: setAllowanceArgs.resetTimeMin,
        },
      ],
    });
  });

  it('ignores a MultiSend sub-call to an address that is not a known Allowance Module', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const batchedTransactions = multiSendTransactionsEncoder([
      {
        operation: Operation.CALL,
        to: getAddress(faker.finance.ethereumAddress()),
        value: BigInt(0),
        data: setAllowanceEncoder().encode(),
      },
    ]);
    const data = multiSendEncoder()
      .with('transactions', batchedTransactions)
      .encode();
    const transaction = multisigTransactionBuilder()
      .with('to', getAddress(faker.finance.ethereumAddress()))
      .with('operation', Operation.CALL)
      .with('data', data)
      .build();

    expect(target.map({ safe, transactions: [transaction] })).toEqual([]);
  });

  it('detects an enableModule call naming a known Allowance Module', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const transaction = multisigTransactionBuilder()
      .with('to', safe.address)
      .with('operation', Operation.CALL)
      .with(
        'data',
        enableModuleEncoder().with('module', SEPOLIA_ALLOWANCE_MODULE).encode(),
      )
      .build();

    const result = target.map({ safe, transactions: [transaction] });

    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual({
      module: SEPOLIA_ALLOWANCE_MODULE,
      changes: [{ kind: 'enable-module', operation: 'create' }],
    });
  });

  it('ignores an enableModule call naming an address that is not a known Allowance Module', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const transaction = multisigTransactionBuilder()
      .with('to', safe.address)
      .with('operation', Operation.CALL)
      .with('data', enableModuleEncoder().encode())
      .build();

    expect(target.map({ safe, transactions: [transaction] })).toEqual([]);
  });

  it('ignores a delegatecall to a known Allowance Module selector', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const transaction = multisigTransactionBuilder()
      .with('to', SEPOLIA_ALLOWANCE_MODULE)
      .with('operation', Operation.DELEGATE)
      .with('data', setAllowanceEncoder().encode())
      .build();

    expect(target.map({ safe, transactions: [transaction] })).toEqual([]);
  });

  it('does not recurse into a nested MultiSend', () => {
    const safe = {
      chainId: SEPOLIA_CHAIN_ID,
      address: getAddress(faker.finance.ethereumAddress()),
    };
    const addDelegate = addDelegateEncoder();
    const addDelegateArgs = addDelegate.build();

    const nestedBatch = multiSendTransactionsEncoder([
      {
        operation: Operation.CALL,
        to: SEPOLIA_ALLOWANCE_MODULE,
        value: BigInt(0),
        data: setAllowanceEncoder().encode(),
      },
    ]);
    const nestedMultiSendCall = multiSendEncoder()
      .with('transactions', nestedBatch)
      .encode();

    const outerBatch = multiSendTransactionsEncoder([
      {
        operation: Operation.CALL,
        to: SEPOLIA_ALLOWANCE_MODULE,
        value: BigInt(0),
        data: addDelegate.encode(),
      },
      {
        // A MultiSendCallOnly address encoding a second multiSend() call - not
        // decoded further.
        operation: Operation.CALL,
        to: getAddress(faker.finance.ethereumAddress()),
        value: BigInt(0),
        data: nestedMultiSendCall,
      },
    ]);
    const data = multiSendEncoder().with('transactions', outerBatch).encode();
    const transaction = multisigTransactionBuilder()
      .with('to', getAddress(faker.finance.ethereumAddress()))
      .with('operation', Operation.CALL)
      .with('data', data)
      .build();

    const result = target.map({ safe, transactions: [transaction] });

    expect(result).toHaveLength(1);
    expect(result[0].data).toEqual({
      module: SEPOLIA_ALLOWANCE_MODULE,
      changes: [
        {
          kind: 'add-delegate',
          operation: 'create',
          delegate: addDelegateArgs.delegate,
        },
      ],
    });
  });
});
