import { faker } from '@faker-js/faker';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import { SafeRepository } from '@/domain/safe/safe.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { TokenRepository } from '@/domain/tokens/token.repository';
import { ILoggingService } from '@/logging/logging.interface';
import { addressInfoBuilder } from '../../../common/__tests__/entities/address-info.builder';
import { AddressInfoHelper } from '../../../common/address-info/address-info.helper';
import { NULL_ADDRESS } from '../../../common/constants';
import { AddressInfo } from '../../../common/entities/address-info.entity';
import { MultisigConfirmationDetails } from '../../entities/transaction-details/multisig-execution-details.entity';
import { MultisigTransactionExecutionDetailsMapper } from './multisig-transaction-execution-details.mapper';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as unknown as AddressInfoHelper);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as unknown as TokenRepository);

const safeRepository = jest.mocked({
  getMultisigTransactions: jest.fn(),
} as unknown as SafeRepository);

const loggingService = jest.mocked({
  debug: jest.fn(),
} as unknown as ILoggingService);

describe('MultisigTransactionExecutionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionDetailsMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    mapper = new MultisigTransactionExecutionDetailsMapper(
      addressInfoHelper,
      tokenRepository,
      safeRepository,
      loggingService,
    );
  });

  it('should return a MultisigExecutionDetails object with gasToken, empty confirmations and empty rejections', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('confirmations', [])
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', []).build(),
    );
    const gasTokenInfo = tokenBuilder().build();
    tokenRepository.getToken.mockResolvedValue(gasTokenInfo);

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        submittedAt: transaction.submissionDate.getTime(),
        nonce: transaction.nonce,
        safeTxGas: transaction.safeTxGas?.toString(),
        baseGas: transaction.baseGas?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        gasToken: transaction.gasToken,
        refundReceiver: addressInfo,
        safeTxHash: transaction.safeTxHash,
        executor: addressInfo,
        signers: safe.owners.map((owner) => new AddressInfo(owner)),
        confirmationsRequired: transaction.confirmationsRequired,
        confirmations: [],
        rejectors: [],
        gasTokenInfo,
        trusted: transaction.trusted,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with NULL_ADDRESS gasToken, confirmations and rejections', async () => {
    const chainId = faker.string.numeric();
    const transactionConfirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('gasToken', NULL_ADDRESS)
      .with('confirmations', transactionConfirmations)
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const rejectionTxConfirmation = confirmationBuilder().build();
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', [rejectionTxConfirmation])
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', [rejectionTx]).build(),
    );
    const expectedConfirmationsDetails = [
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[0].owner),
        transactionConfirmations[0].signature,
        transactionConfirmations[0].submissionDate.getTime(),
      ),
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[1].owner),
        transactionConfirmations[1].signature,
        transactionConfirmations[1].submissionDate.getTime(),
      ),
    ];
    const expectedRejectors = [new AddressInfo(rejectionTxConfirmation.owner)];

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        submittedAt: transaction.submissionDate.getTime(),
        nonce: transaction.nonce,
        safeTxGas: transaction.safeTxGas?.toString(),
        baseGas: transaction.baseGas?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        gasToken: NULL_ADDRESS,
        refundReceiver: addressInfo,
        safeTxHash: transaction.safeTxHash,
        executor: addressInfo,
        signers: safe.owners.map((owner) => new AddressInfo(owner)),
        confirmationsRequired: transaction.confirmationsRequired,
        confirmations: expectedConfirmationsDetails,
        rejectors: expectedRejectors,
        gasTokenInfo: null,
        trusted: transaction.trusted,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with rejectors from rejection transaction only', async () => {
    const chainId = faker.string.numeric();
    const transactionConfirmations = [
      confirmationBuilder().build(),
      confirmationBuilder().build(),
    ];
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('gasToken', NULL_ADDRESS)
      .with('confirmations', transactionConfirmations)
      .build();
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const rejectionTxConfirmation = confirmationBuilder().build();
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', [rejectionTxConfirmation])
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>()
        .with('results', [transaction, rejectionTx]) // returns both rejected and rejection txs
        .build(),
    );
    const expectedConfirmationsDetails = [
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[0].owner),
        transactionConfirmations[0].signature,
        transactionConfirmations[0].submissionDate.getTime(),
      ),
      new MultisigConfirmationDetails(
        new AddressInfo(transactionConfirmations[1].owner),
        transactionConfirmations[1].signature,
        transactionConfirmations[1].submissionDate.getTime(),
      ),
    ];
    const expectedRejectors = [new AddressInfo(rejectionTxConfirmation.owner)];

    const actual = await mapper.mapMultisigExecutionDetails(
      chainId,
      transaction,
      safe,
    );

    expect(actual).toEqual(
      expect.objectContaining({
        type: 'MULTISIG',
        submittedAt: transaction.submissionDate.getTime(),
        nonce: transaction.nonce,
        safeTxGas: transaction.safeTxGas?.toString(),
        baseGas: transaction.baseGas?.toString(),
        gasPrice: transaction.gasPrice?.toString(),
        gasToken: NULL_ADDRESS,
        refundReceiver: addressInfo,
        safeTxHash: transaction.safeTxHash,
        executor: addressInfo,
        signers: safe.owners.map((owner) => new AddressInfo(owner)),
        confirmationsRequired: transaction.confirmationsRequired,
        confirmations: expectedConfirmationsDetails,
        rejectors: expectedRejectors,
        gasTokenInfo: null,
        trusted: transaction.trusted,
      }),
    );
  });
});
