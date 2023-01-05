import { MultisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.factory';
import safeFactory from '../../../../domain/safe/entities/__tests__/safe.factory';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';
import { ConfirmationBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction-confirmation.factory';

describe('Multisig Transaction status mapper (Unit)', () => {
  const mapper = new MultisigTransactionStatusMapper();

  it('should return a SUCCESS status', () => {
    const transaction = new MultisigTransactionBuilder()
      .withIsExecuted(true)
      .withIsSuccessful(true)
      .build();
    const safe = safeFactory();

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Success,
    );
  });

  it('should return a FAILED status', () => {
    const transaction = new MultisigTransactionBuilder()
      .withIsExecuted(true)
      .withIsSuccessful(false)
      .build();
    const safe = safeFactory();

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Failed,
    );
  });

  it('should return a CANCELLED status', () => {
    const transaction = new MultisigTransactionBuilder()
      .withIsExecuted(false)
      .withNonce(2)
      .build();
    const safe = { ...safeFactory(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.Cancelled,
    );
  });

  it('should return an AWAITING_CONFIRMATIONS status', () => {
    const transaction = new MultisigTransactionBuilder()
      .withIsExecuted(false)
      .withNonce(4)
      .withConfirmations([
        new ConfirmationBuilder().build(),
        new ConfirmationBuilder().build(),
      ])
      .withConfirmationsRequired(3)
      .build();
    const safe = { ...safeFactory(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.AwaitingConfirmations,
    );
  });

  it('should return an AWAITING_EXECUTION status', () => {
    const transaction = new MultisigTransactionBuilder()
      .withIsExecuted(false)
      .withNonce(4)
      .withConfirmations([
        new ConfirmationBuilder().build(),
        new ConfirmationBuilder().build(),
      ])
      .withConfirmationsRequired(1)
      .build();
    const safe = { ...safeFactory(), nonce: 3 };

    expect(mapper.mapTransactionStatus(transaction, safe)).toBe(
      TransactionStatus.AwaitingExecution,
    );
  });
});
