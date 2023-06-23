import { faker } from '@faker-js/faker';
import { sample } from 'lodash';
import { multisigTransactionBuilder } from '../../../../domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { safeAppInfoBuilder } from '../../entities/__tests__/safe-app-info.builder';
import { transferTransactionInfoBuilder } from '../../entities/__tests__/transfer-transaction-info.builder';
import { TransactionStatus } from '../../entities/transaction-status.entity';
import { SafeAppInfoMapper } from '../common/safe-app-info.mapper';
import { TransactionDataMapper } from '../common/transaction-data.mapper';
import { MultisigTransactionInfoMapper } from '../common/transaction-info.mapper';
import { MultisigTransactionDetailsMapper } from './multisig-transaction-details.mapper';
import { MultisigTransactionExecutionDetailsMapper } from './multisig-transaction-execution-details.mapper';
import { MultisigTransactionStatusMapper } from './multisig-transaction-status.mapper';

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

const multisigTransactionExecutionDetailsMapper = jest.mocked({
  mapMultisigExecutionDetails: jest.fn(),
} as unknown as MultisigTransactionExecutionDetailsMapper);

describe.skip('MultisigTransactionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionDetailsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new MultisigTransactionDetailsMapper(
      addressInfoHelper,
      statusMapper,
      transactionInfoMapper,
      transactionDataMapper,
      safeAppInfoMapper,
      multisigTransactionExecutionDetailsMapper,
    );
  });

  it('should return a TransactionDetails object', async () => {
    const chainId = faker.string.numeric();
    const transaction = multisigTransactionBuilder().build();
    const safe = safeBuilder().build();
    const txStatus =
      sample(Object.values(TransactionStatus)) ?? TransactionStatus.Success;
    statusMapper.mapTransactionStatus.mockReturnValue(txStatus);
    const txInfo = transferTransactionInfoBuilder().build();
    transactionInfoMapper.mapTransactionInfo.mockResolvedValue(txInfo);
    const safeAppInfo = safeAppInfoBuilder().build();
    safeAppInfoMapper.mapSafeAppInfo.mockResolvedValue(safeAppInfo);

    const actual = await mapper.mapDetails(chainId, transaction, safe);

    expect(actual).toEqual({
      safeAddress: safe.address,
      txId: `multisig_${safe.address}_${transaction.safeTxHash}`,
      executedAt: transaction.executionDate?.getTime(),
      txStatus,
      txInfo,
      // txData,
      txHash: transaction.transactionHash,
      // detailedExecutionInfo,
      safeAppInfo,
    });
  });
});
