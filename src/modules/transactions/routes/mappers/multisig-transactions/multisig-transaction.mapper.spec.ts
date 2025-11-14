import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import type { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { DataDecodedParamHelper } from '@/modules/transactions/routes/mappers/common/data-decoded-param.helper';
import type { SafeAppInfoMapper } from '@/modules/transactions/routes/mappers/common/safe-app-info.mapper';
import type { MultisigTransactionInfoMapper } from '@/modules/transactions/routes/mappers/common/transaction-info.mapper';
import type { MultisigTransactionExecutionInfoMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-info.mapper';
import type { MultisigTransactionStatusMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-status.mapper';
import { MultisigTransactionMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction.mapper';
import type { IDataDecoderRepository } from '@/domain/data-decoder/v2/data-decoder.repository.interface';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { MultisigTransactionNoteMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-note.mapper';
import { TransactionStatus } from '@/modules/transactions/routes/entities/transaction-status.entity';
import { transferTransactionInfoBuilder } from '@/modules/transactions/routes/entities/__tests__/transfer-transaction-info.builder';
import { MultisigExecutionInfo } from '@/modules/transactions/routes/entities/multisig-execution-info.entity';

const mockDataDecodedRepository = {
  getTransactionDataDecoded: jest.fn(),
} as jest.MockedObjectDeep<IDataDecoderRepository>;

describe('MultisigTransactionMapper', () => {
  let mapper: MultisigTransactionMapper;

  const addressInfoHelper = jest.mocked({
    getCollection: jest.fn(),
  } as jest.MockedObjectDeep<AddressInfoHelper>);
  const statusMapper = jest.mocked({
    mapTransactionStatus: jest.fn(),
  } as jest.Mocked<MultisigTransactionStatusMapper>);
  const transactionInfoMapper = {
    mapTransactionInfo: jest.fn(),
  } as unknown as jest.Mocked<MultisigTransactionInfoMapper>;
  const executionInfoMapper = {
    mapExecutionInfo: jest.fn(),
  } as unknown as jest.Mocked<MultisigTransactionExecutionInfoMapper>;
  const safeAppInfoMapper = {
    mapSafeAppInfo: jest.fn(),
  } as unknown as jest.Mocked<SafeAppInfoMapper>;
  const noteMapper = {
    mapTxNote: jest.fn(),
  } as jest.Mocked<MultisigTransactionNoteMapper>;
  const transactionVerifier = {
    verifyApiTransaction: jest.fn(),
    verifyProposal: jest.fn(),
    verifyConfirmation: jest.fn(),
  } as unknown as jest.Mocked<TransactionVerifierHelper>;

  beforeEach(() => {
    jest.resetAllMocks();

    mapper = new MultisigTransactionMapper(
      mockDataDecodedRepository,
      statusMapper,
      transactionInfoMapper,
      executionInfoMapper,
      safeAppInfoMapper,
      noteMapper,
      transactionVerifier,
      addressInfoHelper,
      new DataDecodedParamHelper(),
    );
  });

  describe('prefetchAddressInfos', () => {
    it('should call addressInfoHelper.getCollection with the correct parameters', async () => {
      const chain = chainBuilder().build();
      const safe = safeBuilder().build();
      const tokens = [tokenBuilder().build(), tokenBuilder().build()];
      const contracts = [contractBuilder().build(), contractBuilder().build()];
      const transaction1 = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('to', tokens[0].address)
        .build();
      const decodedData1 = dataDecodedBuilder()
        .with('method', 'transferFrom')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'from')
            .with('value', contracts[0].address)
            .build(),
          dataDecodedParameterBuilder()
            .with('name', 'to')
            .with('value', contracts[1].address)
            .build(),
        ])
        .build();
      const transaction2 = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('to', tokens[1].address)
        .build();
      const decodedData2 = dataDecodedBuilder()
        .with('method', 'transfer')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'to')
            .with('value', tokens[0].address)
            .build(),
        ])
        .build();
      const transaction3 = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('to', tokens[1].address)
        .build();
      const decodedData3 = dataDecodedBuilder()
        .with('method', 'transfer')
        .with('parameters', [
          dataDecodedParameterBuilder()
            .with('name', 'to')
            .with('value', tokens[0].address)
            .build(),
        ])
        .build();
      mockDataDecodedRepository.getTransactionDataDecoded.mockImplementation(
        (args) => {
          const tx = args.transaction as MultisigTransaction;
          if (tx.data === transaction1.data) {
            return Promise.resolve(decodedData1);
          }
          if (tx.data === transaction2.data) {
            return Promise.resolve(decodedData2);
          }
          if (tx.data === transaction3.data) {
            return Promise.resolve(decodedData3);
          }
          return Promise.reject(new Error('Unknown transaction data'));
        },
      );
      await mapper.prefetchAddressInfos({
        chainId: chain.chainId,
        transactions: [transaction1, transaction2, transaction3],
      });

      // Check that the addressInfoHelper.getCollection was called with deduplicated addresses
      expect(addressInfoHelper.getCollection).toHaveBeenCalledWith(
        chain.chainId,
        expect.arrayContaining([
          safe.address,
          tokens[0].address,
          tokens[1].address,
          contracts[0].address,
          contracts[1].address,
        ]),
        ['TOKEN', 'CONTRACT'],
      );
    });
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
      );

      expect(result.note).toBe(expectedNote);
    });
  });
});
