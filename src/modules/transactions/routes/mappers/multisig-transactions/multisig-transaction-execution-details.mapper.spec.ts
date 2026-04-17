import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/modules/safe/domain/entities/multisig-transaction.entity';
import type { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { tokenBuilder } from '@/modules/tokens/domain/__tests__/token.builder';
import type { TokenRepository } from '@/modules/tokens/domain/token.repository';
import { MultisigConfirmationDetails } from '@/modules/transactions/routes/entities/transaction-details/multisig-execution-details.entity';
import { MultisigTransactionExecutionDetailsMapper } from '@/modules/transactions/routes/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';

const addressInfoHelper = jest.mocked({
  getOrDefault: jest.fn(),
} as jest.MockedObjectDeep<AddressInfoHelper>);

const tokenRepository = jest.mocked({
  getToken: jest.fn(),
} as jest.MockedObjectDeep<TokenRepository>);

const safeRepository = jest.mocked({
  getMultisigTransactions: jest.fn(),
} as jest.MockedObjectDeep<SafeRepository>);

const loggingService = jest.mocked({
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('MultisigTransactionExecutionDetails mapper (Unit)', () => {
  let mapper: MultisigTransactionExecutionDetailsMapper;

  beforeEach(() => {
    jest.resetAllMocks();

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
    transaction.safeTxHash = getSafeTxHash({
      chainId,
      transaction,
      safe,
    });
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
        proposer: new AddressInfo(transaction.proposer as `0x${string}`),
        proposedByDelegate: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with NULL_ADDRESS gasToken, confirmations and rejections', async () => {
    const chainId = faker.string.numeric();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('gasToken', NULL_ADDRESS)
      .buildWithConfirmations({
        chainId,
        safe,
        signers,
      });
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const rejectionTxConfirmation = confirmationBuilder().build();
    const rejectionTx = multisigTransactionBuilder()
      .with('confirmations', [rejectionTxConfirmation])
      .build();
    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>().with('results', [rejectionTx]).build(),
    );
    const txConfirmations = transaction.confirmations as NonNullable<
      typeof transaction.confirmations
    >;
    const expectedConfirmationsDetails = [
      new MultisigConfirmationDetails(
        new AddressInfo(txConfirmations[0].owner),
        txConfirmations[0].signature,
        txConfirmations[0].submissionDate.getTime(),
      ),
      new MultisigConfirmationDetails(
        new AddressInfo(txConfirmations[1].owner),
        txConfirmations[1].signature,
        txConfirmations[1].submissionDate.getTime(),
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
        proposer: new AddressInfo(transaction.proposer as `0x${string}`),
        proposedByDelegate: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with rejectors from rejection transaction only', async () => {
    const chainId = faker.string.numeric();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('gasToken', NULL_ADDRESS)
      .buildWithConfirmations({
        chainId,
        safe,
        signers,
      });
    const addressInfo = addressInfoBuilder().build();
    addressInfoHelper.getOrDefault.mockResolvedValue(addressInfo);
    const rejectionTx = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('confirmations', [confirmationBuilder().build()])
      .build();

    safeRepository.getMultisigTransactions.mockResolvedValue(
      pageBuilder<MultisigTransaction>()
        .with('results', [transaction, rejectionTx]) // returns both rejected and rejection txs
        .build(),
    );
    const txConfirmations = transaction.confirmations as NonNullable<
      typeof transaction.confirmations
    >;
    const rejectionConfirmations = rejectionTx.confirmations as NonNullable<
      typeof rejectionTx.confirmations
    >;
    const expectedConfirmationsDetails = [
      new MultisigConfirmationDetails(
        new AddressInfo(txConfirmations[0].owner),
        txConfirmations[0].signature,
        txConfirmations[0].submissionDate.getTime(),
      ),
      new MultisigConfirmationDetails(
        new AddressInfo(txConfirmations[1].owner),
        txConfirmations[1].signature,
        txConfirmations[1].submissionDate.getTime(),
      ),
    ];
    const expectedRejectors = [
      new AddressInfo(rejectionConfirmations[0].owner),
    ];

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
        proposer: new AddressInfo(transaction.proposer as `0x${string}`),
        proposedByDelegate: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object with no proposer if not present', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('proposer', null)
      .with('confirmations', [])
      .build();
    transaction.safeTxHash = getSafeTxHash({
      chainId,
      transaction,
      safe,
    });
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
        proposer: null,
      }),
    );
  });

  it('should return a MultisigExecutionDetails object proposedByDelegate if not present', async () => {
    const chainId = faker.string.numeric();
    const safe = safeBuilder().build();
    const delegate = getAddress(faker.finance.ethereumAddress());
    const transaction = multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('proposer', delegate)
      .with('proposedByDelegate', delegate)
      .with('confirmations', [])
      .build();
    transaction.safeTxHash = getSafeTxHash({
      chainId,
      transaction,
      safe,
    });
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
        proposedByDelegate: new AddressInfo(delegate),
      }),
    );
  });
});
