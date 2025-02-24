import { faker } from '@faker-js/faker';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MultisigExecutionInfo } from '@/routes/transactions/entities/multisig-execution-info.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { MultisigTransactionExecutionInfoMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import { getAddress } from 'viem';

describe('Multisig Transaction execution info mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionInfoMapper;

  beforeEach(() => {
    mapper = new MultisigTransactionExecutionInfoMapper();
  });

  it('should return a MultiSigExecutionInfo with no missing signers', async () => {
    const safe = safeBuilder().build();
    const proposer = faker.finance.ethereumAddress();
    const transaction = (await multisigTransactionBuilder())
      .with('proposer', getAddress(proposer))
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
      ),
    );
  });

  it('should return a MultiSigExecutionInfo with no missing signers and zero confirmations', async () => {
    const safe = safeBuilder().build();
    const transaction = (await multisigTransactionBuilder())
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

  it('should return a MultiSigExecutionInfo with empty missing signers', async () => {
    const safe = safeBuilder().with('owners', []).build();
    const transaction = (await multisigTransactionBuilder()).build();

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

  it('should return a MultiSigExecutionInfo with all safe owners as missing signers', async () => {
    const transaction = (await multisigTransactionBuilder()).build();
    const safe = safeBuilder()
      .with('owners', [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
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

  it('should return a MultiSigExecutionInfo with some safe owners as missing signers', async () => {
    const confirmations = await Promise.all(
      Array.from({ length: 2 }, async () => {
        return (await confirmationBuilder()).build();
      }),
    );

    const transaction = (await multisigTransactionBuilder())
      .with('proposer', getAddress(confirmations[0].owner))
      .with('confirmations', confirmations)
      .build();
    const safe = safeBuilder()
      .with('owners', [
        getAddress(confirmations[0].owner),
        getAddress(faker.finance.ethereumAddress()),
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
        [new AddressInfo(safe.owners[1])],
      ),
    );
  });
});
