import { faker } from '@faker-js/faker';
import { sample } from 'lodash';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { addressInfoBuilder } from '../../../common/__tests__/entities/address-info.builder';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { safeAppInfoBuilder } from '../../entities/__tests__/safe-app-info.builder';
import { transferTransactionInfoBuilder } from '../../entities/__tests__/transfer-transaction-info.builder';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { multisigExecutionDetailsBuilder } from '../__tests__/multisig-execution-details.builder';
import { SafeAppInfoMapper } from '../common/safe-app-info.mapper';
import { TransactionDataMapper } from '../common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '../common/transaction-info.mapper';
import { MultisigTransactionDetailsMapper } from './multisig-transaction-details.mapper';
import { MultisigTransactionExecutionDetailsMapper } from './multisig-transaction-execution-details.mapper';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';
import { ReadableDescriptionsMapper } from 'src/routes/transactions/mappers/common/readable-descriptions.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

const statusMapper = jest.mocked({
  mapTransactionStatus: jest.fn(),
} as unknown as MultisigTransactionStatusMapper);

const transactionInfoMapper = jest.mocked({
  mapTransactionInfo: jest.fn(),
} as unknown as MultisigTransactionInfoMapper);

const transactionDataMapper = jest.mocked({
  isTrustedDelegateCall: jest.fn(),
  buildAddressInfoIndex: jest.fn(),
} as unknown as TransactionDataMapper);

const safeAppInfoMapper = jest.mocked({
  mapSafeAppInfo: jest.fn(),
} as unknown as SafeAppInfoMapper);

const multisigExecutionDetailsMapper = jest.mocked({
  mapMultisigExecutionDetails: jest.fn(),
} as unknown as MultisigTransactionExecutionDetailsMapper);

const readableDescriptionsMapper = jest.mocked({
  mapReadableDescription: jest.fn(),
} as unknown as ReadableDescriptionsMapper);

describe('MultisigTransactionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionDetailsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new MultisigTransactionDetailsMapper(
      addressInfoHelper,
      statusMapper,
      transactionInfoMapper,
      transactionDataMapper,
      safeAppInfoMapper,
      multisigExecutionDetailsMapper,
      readableDescriptionsMapper,
    );
  });

  it('should return a TransactionDetails object with null addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus =
      sample(Object.values(TransactionStatus)) ?? TransactionStatus.Success;
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
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus =
      sample(Object.values(TransactionStatus)) ?? TransactionStatus.Success;
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
