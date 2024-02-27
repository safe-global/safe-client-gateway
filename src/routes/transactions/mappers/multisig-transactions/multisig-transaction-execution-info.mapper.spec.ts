import { faker } from '@faker-js/faker';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MultisigExecutionInfo } from '@/routes/transactions/entities/multisig-execution-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';

describe('Multisig Transaction execution info mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionInfoMapper;

  beforeEach(() => {
    mapper = new MultisigTransactionExecutionInfoMapper();
  });

  it('should return a MultiSigExecutionInfo with no proposer', () => {
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('proposer', null)
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
        Number(transaction.confirmations?.length),
        null,
        null,
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with proposer', () => {
    const safe = safeBuilder().build();
    const proposer = faker.finance.ethereumAddress();
    const transaction = multisigTransactionBuilder()
      .with('proposer', proposer)
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
        Number(transaction.confirmations?.length),
        null,
        new AddressInfo(proposer),
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with no missing signers', () => {
    const safe = safeBuilder().build();
    const proposer = faker.finance.ethereumAddress();
    const transaction = multisigTransactionBuilder()
      .with('proposer', proposer)
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
        Number(transaction.confirmations?.length),
        null,
        new AddressInfo(proposer),
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with no missing signers and zero confirmations', () => {
    const safe = safeBuilder().build();
    const proposer = faker.finance.ethereumAddress();
    const transaction = multisigTransactionBuilder()
      .with('proposer', proposer)
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
        new AddressInfo(proposer),
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with empty missing signers', () => {
    const safe = safeBuilder().with('owners', []).build();
    const proposer = faker.finance.ethereumAddress();
    const transaction = multisigTransactionBuilder()
      .with('proposer', proposer)
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
        [],
        new AddressInfo(proposer),
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with all safe owners as missing signers', () => {
    const proposer = faker.finance.ethereumAddress();
    const transaction = multisigTransactionBuilder()
      .with('proposer', proposer)
      .build();
    const safe = safeBuilder()
      .with('owners', [proposer, faker.finance.ethereumAddress()])
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
        new AddressInfo(proposer),
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with some safe owners as missing signers', () => {
    const proposer = faker.finance.ethereumAddress();
    const confirmations = [
      confirmationBuilder().with('owner', proposer).build(),
      confirmationBuilder().build(),
    ];
    const transaction = multisigTransactionBuilder()
      .with('proposer', proposer)
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
        new AddressInfo(proposer),
      ),
    );
  });
});
