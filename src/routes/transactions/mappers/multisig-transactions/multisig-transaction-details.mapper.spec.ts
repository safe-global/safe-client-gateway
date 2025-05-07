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
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import type { DelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';

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
  buildTokenInfoIndex: jest.fn(),
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

const mockLoggingService = {
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockContractsRepository = jest.mocked({
  isTrustedForDelegateCall: jest.fn(),
} as jest.MockedObjectDeep<IContractsRepository>);

describe('MultisigTransactionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionDetailsMapper;

  function initTarget(args: {
    ethSign: boolean;
    blocklist: Array<`0x${string}`>;
  }): void {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'blockchain.blocklist') return args.blocklist;
      return [
        'features.hashVerification.api',
        'features.signatureVerification.api',
        'features.hashVerification.proposal',
        'features.signatureVerification.proposal',
        args.ethSign ? 'features.ethSign' : null,
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
        mockLoggingService,
        mockContractsRepository,
      ),
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    initTarget({ ethSign: true, blocklist: [] });
  });

  it('should return a TransactionDetails object with null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder().with('owners', [signer.address]).build();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .with('operation', Operation.CALL)
      .buildWithConfirmations({
        chainId,
        safe,
        signers: [signer],
      });
    const dataDecoded = dataDecodedBuilder().build();
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

    const actual = await mapper.mapDetails(
      chainId,
      transaction,
      safe,
      dataDecoded,
    );

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded,
        to,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget: true,
        addressInfoIndex: null,
        tokenInfoIndex: null,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: multisigExecutionDetails,
      safeAppInfo,
    });
  });

  it('should return a TransactionDetails object with non-null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const privateKey = generatePrivateKey();
    const signer = privateKeyToAccount(privateKey);
    const safe = safeBuilder().with('owners', [signer.address]).build();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', safe.nonce)
      .with('operation', Operation.CALL)
      .buildWithConfirmations({
        chainId,
        safe,
        signers: [signer],
      });
    const dataDecoded = dataDecodedBuilder().build();
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

    const actual = await mapper.mapDetails(
      chainId,
      transaction,
      safe,
      dataDecoded,
    );

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded,
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
