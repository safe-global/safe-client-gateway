// SPDX-License-Identifier: FSL-1.1-MIT
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { MultisigTransactionStatusMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';

describe('Multisig Transaction status mapper (Unit)', () => {
  const INDEXING_GRACE_PERIOD_MS = 60 * 1000; // 1 minute (default)
  let mapper: MultisigTransactionStatusMapper;

  beforeEach(() => {
    jest.useFakeTimers();
    const configurationService = {
      get: jest.fn(),
      getOrThrow: jest.fn(<T>(key: string): T => {
        if (key === 'transactions.statusIndexingGracePeriodMs') {
          return INDEXING_GRACE_PERIOD_MS as T;
        }
        throw new Error(`Unexpected config key: ${key}`);
      }),
    } as unknown as IConfigurationService;
    mapper = new MultisigTransactionStatusMapper(configurationService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should return a SUCCESS status', () => {
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .build();
    const safe = safeBuilder().build();

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Success,
    );
  });

  it('should return a FAILED status', () => {
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', true)
      .with('isSuccessful', false)
      .build();
    const safe = safeBuilder().build();

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Failed,
    );
  });

  it('should return a CANCELLED status', () => {
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 2)
      .build();
    const safe = { ...safeBuilder().build(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Cancelled,
    );
  });

  it('should return CANCELLED when nonce passed and not enough confirmations even if recently modified', () => {
    jest.setSystemTime(new Date('2026-02-19T14:22:00.000Z'));
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 2)
      .with('confirmations', [confirmationBuilder().build()])
      .with('confirmationsRequired', 3)
      .with('modified', new Date('2026-02-19T14:21:50.000Z'))
      .build();
    const safe = { ...safeBuilder().build(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Cancelled,
    );
  });

  it('should return CANCELLED when nonce passed and enough confirmations but modified long ago', () => {
    jest.setSystemTime(new Date('2026-02-19T14:22:00.000Z'));
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 2)
      .with('confirmations', [confirmationBuilder().build()])
      .with('confirmationsRequired', 1)
      .with('modified', new Date('2026-02-19T14:00:00.000Z'))
      .build();
    const safe = { ...safeBuilder().build(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Cancelled,
    );
  });

  it('should return AWAITING_EXECUTION instead of CANCELLED during indexing grace period', () => {
    jest.setSystemTime(new Date('2026-02-19T14:22:10.000Z'));
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 46)
      .with('confirmations', [confirmationBuilder().build()])
      .with('confirmationsRequired', 1)
      .with('modified', new Date('2026-02-19T14:22:02.139Z'))
      .build();
    const safe = { ...safeBuilder().build(), nonce: 47 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.AwaitingExecution,
    );
  });

  it('should return an AWAITING_CONFIRMATIONS status', () => {
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 4)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .with('confirmationsRequired', 3)
      .build();
    const safe = { ...safeBuilder().build(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.AwaitingConfirmations,
    );
  });

  it('should return an AWAITING_EXECUTION status', () => {
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 4)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .with('confirmationsRequired', 1)
      .build();
    const safe = { ...safeBuilder().build(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.AwaitingExecution,
    );
  });
});
