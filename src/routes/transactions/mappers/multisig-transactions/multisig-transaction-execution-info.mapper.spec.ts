import { faker } from '@faker-js/faker';
import multisigTransactionConfirmationFactory from '../../../../domain/safe/entities/__tests__/multisig-transaction-confirmation.factory';
import { MultisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.factory';
import safeFactory from '../../../../domain/safe/entities/__tests__/safe.factory';
import { MultisigExecutionInfo } from '../../entities/multisig-execution-info.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { MultisigTransactionExecutionInfoMapper } from './multisig-transaction-execution-info.mapper';

describe('Multisig Transaction execution info mapper (Unit)', () => {
  const mapper = new MultisigTransactionExecutionInfoMapper();

  it('should return a MultiSigExecutionInfo with no missing signers', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.Success;
    const confirmations = [
      multisigTransactionConfirmationFactory(),
      multisigTransactionConfirmationFactory(),
    ];
    const safe = safeFactory();
    const transaction = new MultisigTransactionBuilder()
      .withNonce(nonce)
      .withConfirmations(confirmations)
      .withConfirmationsRequired(confirmationsRequired)
      .build();

    const executionInfo = mapper.mapExecutionInfo(transaction, safe, txStatus);

    expect(executionInfo).toBeInstanceOf(MultisigExecutionInfo);
    expect(executionInfo).toHaveProperty('nonce', nonce);
    expect(executionInfo).toHaveProperty(
      'confirmationsRequired',
      confirmationsRequired,
    );
    expect(executionInfo).toHaveProperty(
      'confirmationsSubmitted',
      confirmations.length,
    );
    expect(executionInfo).toHaveProperty('missingSigners', null);
  });

  it('should return a MultiSigExecutionInfo with no missing signers and zero confirmations', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.Success;
    const safe = safeFactory();
    const transaction = new MultisigTransactionBuilder()
      .withNonce(nonce)
      .withConfirmations(null)
      .withConfirmationsRequired(confirmationsRequired)
      .build();

    const executionInfo = mapper.mapExecutionInfo(transaction, safe, txStatus);

    expect(executionInfo).toBeInstanceOf(MultisigExecutionInfo);
    expect(executionInfo).toHaveProperty('nonce', nonce);
    expect(executionInfo).toHaveProperty(
      'confirmationsRequired',
      confirmationsRequired,
    );
    expect(executionInfo).toHaveProperty('confirmationsSubmitted', 0);
    expect(executionInfo).toHaveProperty('missingSigners', null);
  });

  it('should return a MultiSigExecutionInfo with empty missing signers', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.AwaitingConfirmations;
    const confirmations = [
      multisigTransactionConfirmationFactory(),
      multisigTransactionConfirmationFactory(),
    ];
    const safeOwners = [];
    const safe = safeFactory(undefined, undefined, undefined, safeOwners);
    const transaction = new MultisigTransactionBuilder()
      .withNonce(nonce)
      .withConfirmations(confirmations)
      .withConfirmationsRequired(confirmationsRequired)
      .build();

    const executionInfo = mapper.mapExecutionInfo(transaction, safe, txStatus);

    expect(executionInfo).toBeInstanceOf(MultisigExecutionInfo);
    expect(executionInfo).toHaveProperty('nonce', nonce);
    expect(executionInfo).toHaveProperty(
      'confirmationsRequired',
      confirmationsRequired,
    );
    expect(executionInfo).toHaveProperty(
      'confirmationsSubmitted',
      confirmations.length,
    );
    expect(executionInfo).toHaveProperty('missingSigners', []);
  });

  it('should return a MultiSigExecutionInfo with all safe owners as missing signers', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.AwaitingConfirmations;
    const confirmations = [
      multisigTransactionConfirmationFactory(),
      multisigTransactionConfirmationFactory(),
    ];
    const safeOwners = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const safe = safeFactory(undefined, undefined, undefined, safeOwners);
    const transaction = new MultisigTransactionBuilder()
      .withNonce(nonce)
      .withConfirmations(confirmations)
      .withConfirmationsRequired(confirmationsRequired)
      .build();

    const executionInfo = mapper.mapExecutionInfo(transaction, safe, txStatus);

    expect(executionInfo).toBeInstanceOf(MultisigExecutionInfo);
    expect(executionInfo).toHaveProperty('nonce', nonce);
    expect(executionInfo).toHaveProperty(
      'confirmationsRequired',
      confirmationsRequired,
    );
    expect(executionInfo).toHaveProperty(
      'confirmationsSubmitted',
      confirmations.length,
    );
    expect(executionInfo).toHaveProperty(
      'missingSigners',
      safeOwners.map((address) => ({ value: address })),
    );
  });

  it('should return a MultiSigExecutionInfo with some safe owners as missing signers', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.AwaitingConfirmations;
    const confirmations = [
      multisigTransactionConfirmationFactory(),
      multisigTransactionConfirmationFactory(),
    ];
    const safeOwners = [
      confirmations[0].owner,
      faker.finance.ethereumAddress(),
    ];
    const safe = safeFactory(undefined, undefined, undefined, safeOwners);
    const transaction = new MultisigTransactionBuilder()
      .withNonce(nonce)
      .withConfirmations(confirmations)
      .withConfirmationsRequired(confirmationsRequired)
      .build();

    const executionInfo = mapper.mapExecutionInfo(transaction, safe, txStatus);

    expect(executionInfo).toBeInstanceOf(MultisigExecutionInfo);
    expect(executionInfo).toHaveProperty('nonce', nonce);
    expect(executionInfo).toHaveProperty(
      'confirmationsRequired',
      confirmationsRequired,
    );
    expect(executionInfo).toHaveProperty(
      'confirmationsSubmitted',
      confirmations.length,
    );
    expect(executionInfo).toHaveProperty('missingSigners', [
      { value: safeOwners[1] },
    ]);
  });
});
