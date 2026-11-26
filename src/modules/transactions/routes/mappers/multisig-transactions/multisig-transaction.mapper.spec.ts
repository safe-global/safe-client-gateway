// SPDX-License-Identifier: FSL-1.1-MIT
import type { Mocked, MockedObject } from 'vitest';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { SafeAppInfoMapper } from '#/modules/safe-apps/mappers/safe-app-info.mapper';
import { transferTransactionInfoBuilder } from '#/modules/transactions/routes/entities/__tests__/transfer-transaction-info.builder';
import { MultisigExecutionInfo } from '#/modules/transactions/routes/entities/multisig-execution-info.entity';
import { TransactionStatus } from '#/modules/transactions/routes/entities/transaction-status.entity';
import type { TransactionVerifierHelper } from '#/modules/transactions/routes/helpers/transaction-verifier.helper';
import type { MultisigTransactionInfoMapper } from '#/modules/transactions/routes/mappers/common/transaction-info.mapper';
import { MultisigTransactionMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import type { MultisigTransactionExecutionInfoMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import type { MultisigTransactionNoteMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import type { MultisigTransactionStatusMapper } from '#/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';
import type { AddressLookups } from '#/routes/common/address-info/address-lookups';

describe('MultisigTransactionMapper', () => {
  let mapper: MultisigTransactionMapper;

  const addressLookups = vi.mocked({
    getOrDefault: vi.fn(),
  } as MockedObject<AddressLookups>);
  const statusMapper = {
    mapTransactionStatus: vi.fn(),
  } as unknown as Mocked<MultisigTransactionStatusMapper>;
  const transactionInfoMapper = {
    mapTransactionInfo: vi.fn(),
  } as unknown as Mocked<MultisigTransactionInfoMapper>;
  const executionInfoMapper = {
    mapExecutionInfo: vi.fn(),
  } as unknown as Mocked<MultisigTransactionExecutionInfoMapper>;
  const safeAppInfoMapper = {
    mapSafeAppInfo: vi.fn(),
  } as unknown as Mocked<SafeAppInfoMapper>;
  const noteMapper = {
    mapTxNote: vi.fn(),
  } as Mocked<MultisigTransactionNoteMapper>;
  const transactionVerifier = {
    verifyApiTransaction: vi.fn(),
    verifyProposal: vi.fn(),
    verifyConfirmation: vi.fn(),
  } as unknown as Mocked<TransactionVerifierHelper>;

  beforeEach(() => {
    vi.resetAllMocks();

    mapper = new MultisigTransactionMapper(
      statusMapper,
      transactionInfoMapper,
      executionInfoMapper,
      safeAppInfoMapper,
      noteMapper,
      transactionVerifier,
    );
  });

  describe('mapTransaction', () => {
    it('should map the transaction note', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const transaction = multisigTransactionBuilder().build();
      const expectedNote = 'a note';

      noteMapper.mapTxNote.mockReturnValue(expectedNote);
      statusMapper.mapTransactionStatus.mockReturnValue(
        TransactionStatus.Success,
      );
      transactionInfoMapper.mapTransactionInfo.mockResolvedValue(
        transferTransactionInfoBuilder().build(),
      );
      executionInfoMapper.mapExecutionInfo.mockReturnValue(
        new MultisigExecutionInfo(0, 0, 0, null),
      );
      safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(null);

      const result = await mapper.mapTransaction(
        chain.chainId,
        transaction,
        safe,
        null,
        addressLookups,
      );

      expect(result.note).toBe(expectedNote);
    });

    it('should map the transaction info with the given address lookups', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const transaction = multisigTransactionBuilder().build();
      const txInfo = transferTransactionInfoBuilder().build();

      statusMapper.mapTransactionStatus.mockReturnValue(
        TransactionStatus.Success,
      );
      transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
      executionInfoMapper.mapExecutionInfo.mockReturnValue(
        new MultisigExecutionInfo(0, 0, 0, null),
      );
      safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(null);

      const result = await mapper.mapTransaction(
        chain.chainId,
        transaction,
        safe,
        null,
        addressLookups,
      );

      expect(result.txInfo).toBe(txInfo);
      expect(transactionInfoMapper.mapTransactionInfo).toHaveBeenCalledWith(
        chain.chainId,
        transaction,
        null,
        addressLookups,
        null,
      );
    });

    it.each([
      [TransactionStatus.AwaitingConfirmations, true],
      [TransactionStatus.AwaitingExecution, true],
      [TransactionStatus.Success, false],
      [TransactionStatus.Failed, false],
      [TransactionStatus.Cancelled, false],
    ])(
      'should pass the Safe to the transaction info for status %s: %s',
      async (txStatus, isQueued) => {
        const chain = chainBuilder().build();
        const safe = safeBuilder().build();
        const transaction = multisigTransactionBuilder().build();

        statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
        transactionInfoMapper.mapTransactionInfo.mockResolvedValue(
          transferTransactionInfoBuilder().build(),
        );
        executionInfoMapper.mapExecutionInfo.mockReturnValue(
          new MultisigExecutionInfo(0, 0, 0, null),
        );
        safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(null);

        await mapper.mapTransaction(
          chain.chainId,
          transaction,
          safe,
          null,
          addressLookups,
        );

        expect(transactionInfoMapper.mapTransactionInfo).toHaveBeenCalledWith(
          chain.chainId,
          transaction,
          null,
          addressLookups,
          isQueued ? safe : null,
        );
      },
    );
  });
});
