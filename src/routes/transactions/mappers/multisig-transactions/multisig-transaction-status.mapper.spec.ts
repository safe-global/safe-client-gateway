import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';

describe('Multisig Transaction status mapper (Unit)', () => {
  let mapper: MultisigTransactionStatusMapper;

  beforeEach(() => {
    mapper = new MultisigTransactionStatusMapper();
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

  it('should return an AWAITING_EXECUTION status based on confirmationsRequired', () => {
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

  it('should return an AWAITING_EXECUTION status based on threshold if confirmationsRequired is null', () => {
    const transaction = multisigTransactionBuilder()
      .with('isExecuted', false)
      .with('nonce', 4)
      .with('confirmations', [
        confirmationBuilder().build(),
        confirmationBuilder().build(),
      ])
      .with('confirmationsRequired', null)
      .build();
    const safe = safeBuilder().with('nonce', 3).with('threshold', 1).build();

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.AwaitingExecution,
    );
  });
});
