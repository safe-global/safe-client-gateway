import { faker } from '@faker-js/faker';
import { erc20TransferBuilder } from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { transferTransactionInfoBuilder } from '@/routes/transactions/entities/__tests__/transfer-transaction-info.builder';
import { TransferDetailsMapper } from '@/routes/transactions/mappers/transfers/transfer-details.mapper';
import { TransferInfoMapper } from '@/routes/transactions/mappers/transfers/transfer-info.mapper';

const transferInfoMapper = jest.mocked({
  mapTransferInfo: jest.fn(),
} as unknown as TransferInfoMapper);

describe('TransferDetails mapper (Unit)', () => {
  let mapper: TransferDetailsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new TransferDetailsMapper(transferInfoMapper);
  });

  it('should return a TransactionDetails object', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc20TransferBuilder().build();
    const safe = safeBuilder().build();
    const transferInfo = transferTransactionInfoBuilder().build();
    transferInfoMapper.mapTransferInfo.mockResolvedValue(transferInfo);

    const actual = await mapper.mapDetails(chainId, transfer, safe, 0);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `transfer_${safe.address}_${transfer.transferId}`,
      executedAt: transfer.executionDate.getTime(),
      txStatus: 'SUCCESS',
      txInfo: transferInfo,
      txData: null,
      detailedExecutionInfo: null,
      txHash: transfer.transactionHash,
      safeAppInfo: null,
    });
  });

  it('should return an execution date with a timezone offset', async () => {
    const chainId = faker.string.numeric();
    const transfer = erc20TransferBuilder().build();
    const safe = safeBuilder().build();
    const transferInfo = transferTransactionInfoBuilder().build();
    transferInfoMapper.mapTransferInfo.mockResolvedValue(transferInfo);
    const timezoneOffset = faker.number.int({
      min: -12 * 60 * 60 * 1000,
      max: 12 * 60 * 60 * 1000,
    }); // range from -12 hours to +12 hours

    const actual = await mapper.mapDetails(
      chainId,
      transfer,
      safe,
      timezoneOffset,
    );

    const expectedExecutionDate =
      transfer.executionDate.getTime() + timezoneOffset;
    expect(actual).toMatchObject({
      executedAt: expectedExecutionDate,
    });
  });
});
