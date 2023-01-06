import { faker } from '@faker-js/faker';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { MultisigExecutionInfo } from '../../entities/multisig-execution-info.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { MultisigTransactionExecutionInfoMapper } from './multisig-transaction-execution-info.mapper';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';

describe('Multisig Transaction execution info mapper (Unit)', () => {
  const mapper = new MultisigTransactionExecutionInfoMapper();

  it('should return a MultiSigExecutionInfo with no missing signers', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.Success;
    const confirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('nonce', nonce)
      .with('confirmations', confirmations)
      .with('confirmationsRequired', confirmationsRequired)
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
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('nonce', nonce)
      .with('confirmations', null)
      .with('confirmationsRequired', confirmationsRequired)
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
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safeOwners = [];
    const safe = safeBuilder().with('owners', safeOwners).build();
    const transaction = multisigTransactionBuilder()
      .with('nonce', nonce)
      .with('confirmations', confirmations)
      .with('confirmationsRequired', confirmationsRequired)
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
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safeOwners = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const safe = safeBuilder().with('owners', safeOwners).build();
    const transaction = multisigTransactionBuilder()
      .with('nonce', nonce)
      .with('confirmations', confirmations)
      .with('confirmationsRequired', confirmationsRequired)
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
      safeOwners.map((address) => new AddressInfo(address)),
    );
  });

  it('should return a MultiSigExecutionInfo with some safe owners as missing signers', () => {
    const nonce = faker.datatype.number({ min: 0 });
    const confirmationsRequired = faker.datatype.number({ min: 0 });
    const txStatus = TransactionStatus.AwaitingConfirmations;
    const confirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safeOwners = [
      confirmations[0].owner,
      faker.finance.ethereumAddress(),
    ];
    const safe = safeBuilder().with('owners', safeOwners).build();
    const transaction = multisigTransactionBuilder()
      .with('nonce', nonce)
      .with('confirmations', confirmations)
      .with('confirmationsRequired', confirmationsRequired)
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
      new AddressInfo(safeOwners[1]),
    ]);
  });
});
