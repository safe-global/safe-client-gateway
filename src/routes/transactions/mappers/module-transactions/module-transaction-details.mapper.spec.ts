import { faker } from '@faker-js/faker';
import { sample } from 'lodash';
import { moduleTransactionBuilder } from '@/domain/safe/entities/__tests__/module-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { transferTransactionInfoBuilder } from '@/routes/transactions/entities/__tests__/transfer-transaction-info.builder';
import { ModuleExecutionDetails } from '@/routes/transactions/entities/transaction-details/module-execution-details.entity';
import { TransactionStatus } from '@/routes/transactions/entities/transaction-status.entity';
import { TransactionDataMapper } from '@/routes/transactions/mappers/common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '@/routes/transactions/mappers/common/transaction-info.mapper';
import { ModuleTransactionDetailsMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-details.mapper';
import { ModuleTransactionStatusMapper } from '@/routes/transactions/mappers/module-transactions/module-transaction-status.mapper';

describe('ModuleTransactionDetails mapper (Unit)', () => {
  let mapper: ModuleTransactionDetailsMapper;

  const addressInfoHelper = jest.mocked({
    getOrDefault: jest.fn(),
  } as unknown as AddressInfoHelper);

  const statusMapper = jest.mocked({
    mapTransactionStatus: jest.fn(),
  } as unknown as ModuleTransactionStatusMapper);

  const transactionInfoMapper = jest.mocked({
    mapTransactionInfo: jest.fn(),
  } as unknown as MultisigTransactionInfoMapper);

  const transactionDataMapper = jest.mocked({
    isTrustedDelegateCall: jest.fn(),
    buildAddressInfoIndex: jest.fn(),
  } as unknown as TransactionDataMapper);

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new ModuleTransactionDetailsMapper(
      addressInfoHelper,
      statusMapper,
      transactionInfoMapper,
      transactionDataMapper,
    );
  });

  it('should return a TransactionDetails object with an empty addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = moduleTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus =
      sample(Object.values(TransactionStatus)) ?? TransactionStatus.Success;
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue({});
    const trustedDelegateCallTarget = faker.datatype.boolean();
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(
      trustedDelegateCallTarget,
    );

    const actual = await mapper.mapDetails(chainId, transaction, 0);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `module_${safe.address}_${transaction.moduleTransactionId}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded: transaction.dataDecoded,
        to: addressInfo,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget,
        addressInfoIndex: null,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: new ModuleExecutionDetails(addressInfo),
      safeAppInfo: null,
    });
  });

  it('should return an execution date with a timezone offset', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = moduleTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus =
      sample(Object.values(TransactionStatus)) ?? TransactionStatus.Success;
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue({});
    const trustedDelegateCallTarget = faker.datatype.boolean();
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(
      trustedDelegateCallTarget,
    );
    const timezoneOffset = faker.number.int({
      min: -12 * 60 * 60 * 1000,
      max: 12 * 60 * 60 * 1000,
    }); // range from -12 hours to +12 hours

    const actual = await mapper.mapDetails(
      chainId,
      transaction,
      timezoneOffset,
    );

    const expectedExecutionDate =
      transaction.executionDate.getTime() + timezoneOffset;
    expect(actual).toMatchObject({
      executedAt: expectedExecutionDate,
    });
  });

  it('should return a TransactionDetails object with an non-empty addressInfoIndex', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = moduleTransactionBuilder()
      .with('safe', safe.address)
      .build();
    const txStatus =
      sample(Object.values(TransactionStatus)) ?? TransactionStatus.Success;
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const addressInfoIndex = {
      [faker.string.sample()]: addressInfoBuilder().build(),
      [faker.string.sample()]: addressInfoBuilder().build(),
    };
    transactionDataMapper.buildAddressInfoIndex.mockResolvedValue(
      addressInfoIndex,
    );
    const trustedDelegateCallTarget = faker.datatype.boolean();
    transactionDataMapper.isTrustedDelegateCall.mockResolvedValue(
      trustedDelegateCallTarget,
    );

    const actual = await mapper.mapDetails(chainId, transaction, 0);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `module_${safe.address}_${transaction.moduleTransactionId}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      txData: expect.objectContaining({
        hexData: transaction.data,
        dataDecoded: transaction.dataDecoded,
        to: addressInfo,
        value: transaction.value,
        operation: transaction.operation,
        trustedDelegateCallTarget,
        addressInfoIndex,
      }),
      txHash: transaction.transactionHash,
      detailedExecutionInfo: new ModuleExecutionDetails(addressInfo),
      safeAppInfo: null,
    });
  });
});
