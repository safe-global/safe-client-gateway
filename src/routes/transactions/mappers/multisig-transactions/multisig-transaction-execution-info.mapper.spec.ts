import { faker } from '@faker-js/faker';
import { confirmationBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { MultisigExecutionInfo } from '../../entities/multisig-execution-info.entity';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { MultisigTransactionExecutionInfoMapper } from './multisig-transaction-execution-info.mapper';

describe('Multisig Transaction execution info mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionInfoMapper;

  beforeEach(() => {
    mapper = new MultisigTransactionExecutionInfoMapper();
  });

  it('should return a MultiSigExecutionInfo with no missing signers', () => {
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder().build();
    const executionInfo = mapper.mapExecutionInfo(
      transaction,
      safe,
      TransactionStatus.Success,
    );

    expect(executionInfo).toEqual(
      new MultisigExecutionInfo(
        transaction.nonce,
        transaction.confirmationsRequired,
        Number(transaction.confirmations?.length),
        null,
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with no missing signers and zero confirmations', () => {
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('confirmations', null)
      .build();
    const executionInfo = mapper.mapExecutionInfo(
      transaction,
      safe,
      TransactionStatus.Success,
    );

    expect(executionInfo).toEqual(
      new MultisigExecutionInfo(
        transaction.nonce,
        transaction.confirmationsRequired,
        0,
        null,
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with empty missing signers', () => {
    const safe = safeBuilder().with('owners', []).build();
    const transaction = multisigTransactionBuilder().build();
    const executionInfo = mapper.mapExecutionInfo(
      transaction,
      safe,
      TransactionStatus.AwaitingConfirmations,
    );

    expect(executionInfo).toEqual(
      new MultisigExecutionInfo(
        transaction.nonce,
        transaction.confirmationsRequired,
        Number(transaction.confirmations?.length),
        [],
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with all safe owners as missing signers', () => {
    const transaction = multisigTransactionBuilder().build();
    const safe = safeBuilder()
      .with('owners', [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ])
      .build();
    const executionInfo = mapper.mapExecutionInfo(
      transaction,
      safe,
      TransactionStatus.AwaitingConfirmations,
    );

    expect(executionInfo).toEqual(
      new MultisigExecutionInfo(
        transaction.nonce,
        transaction.confirmationsRequired,
        Number(transaction.confirmations?.length),
        safe.owners.map((address) => new AddressInfo(address)),
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with some safe owners as missing signers', () => {
    const confirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const transaction = multisigTransactionBuilder()
      .with('confirmations', confirmations)
      .build();
    const safe = safeBuilder()
      .with('owners', [confirmations[0].owner, faker.finance.ethereumAddress()])
      .build();

    const executionInfo = mapper.mapExecutionInfo(
      transaction,
      safe,
      TransactionStatus.AwaitingConfirmations,
    );

    expect(executionInfo).toEqual(
      new MultisigExecutionInfo(
        transaction.nonce,
        transaction.confirmationsRequired,
        Number(transaction.confirmations?.length),
        [new AddressInfo(safe.owners[1])],
      ),
    );
  });
});
