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

  describe('based on confirmationsRequired', () => {
    it('should return a MultiSigExecutionInfo with no missing signers', () => {
      const safe = safeBuilder().build();
      const proposer = faker.finance.ethereumAddress();
      const transaction = multisigTransactionBuilder()
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
          transaction.confirmationsRequired!,
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
          transaction.confirmationsRequired!,
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
          transaction.confirmationsRequired!,
          Number(transaction.confirmations?.length),
          [],
        ),
      );
    });

    it('should return a MultiSigExecutionInfo with all safe owners as missing signers', () => {
      const transaction = multisigTransactionBuilder().build();
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
          transaction.confirmationsRequired!,
          Number(transaction.confirmations?.length),
          safe.owners.map((address) => new AddressInfo(address)),
        ),
      );
    });

    it('should return a MultiSigExecutionInfo with some safe owners as missing signers', () => {
      const confirmations = [
        confirmationBuilder()
          .with('owner', getAddress(faker.finance.ethereumAddress()))
          .build(),
        confirmationBuilder()
          .with('owner', getAddress(faker.finance.ethereumAddress()))
          .build(),
      ];
      const transaction = multisigTransactionBuilder()
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
          transaction.confirmationsRequired!,
          Number(transaction.confirmations?.length),
          [new AddressInfo(safe.owners[1])],
        ),
      );
    });
  });

  describe('based on threshold when confirmationsRequired is null', () => {
    it('should return a MultiSigExecutionInfo with no missing signers', () => {
      const safe = safeBuilder().build();
      const proposer = faker.finance.ethereumAddress();
      const transaction = multisigTransactionBuilder()
        .with('proposer', getAddress(proposer))
        .with('confirmationsRequired', null)
        .build();

      const executionInfo = mapper.mapExecutionInfo(
        transaction,
        safe,
        TransactionStatus.Success,
      );

      expect(executionInfo).toEqual(
        new MultisigExecutionInfo(
          transaction.nonce,
          safe.threshold,
          Number(transaction.confirmations?.length),
          null,
        ),
      );
    });

    it('should return a MultiSigExecutionInfo with no missing signers and zero confirmations', () => {
      const safe = safeBuilder().build();
      const transaction = multisigTransactionBuilder()
        .with('confirmations', null)
        .with('confirmationsRequired', null)
        .build();

      const executionInfo = mapper.mapExecutionInfo(
        transaction,
        safe,
        TransactionStatus.Success,
      );

      expect(executionInfo).toEqual(
        new MultisigExecutionInfo(transaction.nonce, safe.threshold, 0, null),
      );
    });

    it('should return a MultiSigExecutionInfo with empty missing signers', () => {
      const safe = safeBuilder()
        .with('owners', [])
        .with('threshold', 0)
        .build();
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', null)
        .build();

      const executionInfo = mapper.mapExecutionInfo(
        transaction,
        safe,
        TransactionStatus.AwaitingConfirmations,
      );

      expect(executionInfo).toEqual(
        new MultisigExecutionInfo(
          transaction.nonce,
          safe.threshold,
          Number(transaction.confirmations?.length),
          [],
        ),
      );
    });

    it('should return a MultiSigExecutionInfo with all safe owners as missing signers', () => {
      const transaction = multisigTransactionBuilder()
        .with('confirmationsRequired', null)
        .build();
      const safe = safeBuilder()
        .with('owners', [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .with('threshold', 2)
        .build();

      const executionInfo = mapper.mapExecutionInfo(
        transaction,
        safe,
        TransactionStatus.AwaitingConfirmations,
      );

      expect(executionInfo).toEqual(
        new MultisigExecutionInfo(
          transaction.nonce,
          safe.threshold,
          Number(transaction.confirmations?.length),
          safe.owners.map((address) => new AddressInfo(address)),
        ),
      );
    });

    it('should return a MultiSigExecutionInfo with some safe owners as missing signers', () => {
      const confirmations = [
        confirmationBuilder()
          .with('owner', getAddress(faker.finance.ethereumAddress()))
          .build(),
        confirmationBuilder()
          .with('owner', getAddress(faker.finance.ethereumAddress()))
          .build(),
      ];
      const transaction = multisigTransactionBuilder()
        .with('proposer', getAddress(confirmations[0].owner))
        .with('confirmations', confirmations)
        .with('confirmationsRequired', null)
        .build();
      const safe = safeBuilder()
        .with('owners', [
          getAddress(confirmations[0].owner),
          getAddress(faker.finance.ethereumAddress()),
        ])
        .with('threshold', 2)
        .build();

      const executionInfo = mapper.mapExecutionInfo(
        transaction,
        safe,
        TransactionStatus.AwaitingConfirmations,
      );

      expect(executionInfo).toEqual(
        new MultisigExecutionInfo(
          transaction.nonce,
          safe.threshold,
          Number(transaction.confirmations?.length),
          [new AddressInfo(safe.owners[1])],
        ),
      );
    });
  });
});
