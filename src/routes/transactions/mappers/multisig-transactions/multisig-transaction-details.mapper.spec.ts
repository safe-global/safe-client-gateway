import { faker } from '@faker-js/faker';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { safeAppInfoBuilder } from '@/routes/transactions/entities/__tests__/safe-app-info.builder';
import { transferTransactionInfoBuilder } from '@/routes/transactions/entities/__tests__/transfer-transaction-info.builder';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { multisigExecutionDetailsBuilder } from '@/routes/transactions/mappers/__tests__/multisig-execution-details.builder';
import type { SafeAppInfoMapper } from '@/routes/transactions/mappers/common/safe-app-info.mapper';
import type { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import type { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { MultisigTransactionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-details.mapper';
import type { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import type { MultisigTransactionStatusMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-status.mapper';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import type { DelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const statusMapper = jest.mocked({
  mapTransactionStatus: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionStatusMapper>);

const transactionInfoMapper = jest.mocked({
  mapTransactionInfo: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionInfoMapper>);

const transactionDataMapper = jest.mocked({
  isTrustedDelegateCall: jest.fn(),
  buildAddressInfoIndex: jest.fn(),
} as jest.MockedObjectDeep<TransactionDataMapper>);

const safeAppInfoMapper = jest.mocked({
  mapSafeAppInfo: jest.fn(),
} as jest.MockedObjectDeep<SafeAppInfoMapper>);

const multisigExecutionDetailsMapper = jest.mocked({
  mapMultisigExecutionDetails: jest.fn(),
} as jest.MockedObjectDeep<MultisigTransactionExecutionDetailsMapper>);

const multisigTransactionNoteMapper = jest.mocked({
  mapTxNote: jest.fn(),
});

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockDelegatesRepository = jest.mocked({
  getDelegates: jest.fn(),
} as jest.MockedObjectDeep<DelegatesV2Repository>);

describe('MultisigTransactionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionDetailsMapper;

  beforeEach(() => {
    jest.resetAllMocks();

    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      return [
        'features.hashVerification',
        'features.signatureVerification',
      ].includes(key);
    });
    mapper = new MultisigTransactionDetailsMapper(
      addressInfoHelper,
      statusMapper,
      transactionInfoMapper,
      transactionDataMapper,
      safeAppInfoMapper,
      multisigExecutionDetailsMapper,
      multisigTransactionNoteMapper,
      new TransactionVerifierHelper(
        mockConfigurationService,
        mockDelegatesRepository,
      ),
    );
  });

  it('should return a TransactionDetails object with null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = (await multisigTransactionBuilder())
      .with('safe', safe.address)
      .build();
    transaction.safeTxHash = getSafeTxHash({
      chainId,
      transaction,
      safe,
    });
    transaction.confirmations = [
      (await confirmationBuilder(transaction.safeTxHash)).build(),
    ];
    const txStatus = faker.helpers.objectValue(TransactionStatus);
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const safeAppInfo = safeAppInfoBuilder().build();
    safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(safeAppInfo);
    const multisigExecutionDetails = multisigExecutionDetailsBuilder().build();
    multisigExecutionDetailsMapper.mapMultisigExecutionDetails.mockResolvedValue(
      multisigExecutionDetails,
    );
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(true);
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue({});
    const to = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(to);

    const actual = await mapper.mapDetails(chainId, transaction, safe);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded: transaction.dataDecoded,
        to,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget: true,
        addressInfoIndex: null,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: multisigExecutionDetails,
      safeAppInfo,
    });
  });

  it('should return a TransactionDetails object with non-null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = (await multisigTransactionBuilder())
      .with('safe', safe.address)
      .build();
    transaction.safeTxHash = getSafeTxHash({ chainId, transaction, safe });
    transaction.confirmations = [
      (await confirmationBuilder(transaction.safeTxHash)).build(),
    ];
    const txStatus = faker.helpers.objectValue(TransactionStatus);
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const safeAppInfo = safeAppInfoBuilder().build();
    safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(safeAppInfo);
    const multisigExecutionDetails = multisigExecutionDetailsBuilder().build();
    multisigExecutionDetailsMapper.mapMultisigExecutionDetails.mockResolvedValue(
      multisigExecutionDetails,
    );
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(true);
    const addressInfoIndex = {
      [faker.string.sample()]: addressInfoBuilder().build(),
      [faker.string.sample()]: addressInfoBuilder().build(),
    };
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue(
      addressInfoIndex,
    );
    const to = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(to);

    const actual = await mapper.mapDetails(chainId, transaction, safe);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded: transaction.dataDecoded,
        to,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget: true,
        addressInfoIndex,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: multisigExecutionDetails,
      safeAppInfo,
    });
  });
});
