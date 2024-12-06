import { faker } from '@faker-js/faker';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '@/domain/safe/entities/multisig-transaction.entity';
import type { SafeRepository } from '@/domain/safe/safe.repository';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import type { TokenRepository } from '@/domain/tokens/token.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import { addressInfoBuilder } from '@/routes/common/__tests__/entities/address-info.builder';
import type { AddressInfoHelper } from '@/routes/common/address-info/address-info.helper';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { MultisigConfirmationDetails } from '@/routes/transactions/entities/transaction-details/multisig-execution-details.entity';
import { MultisigTransactionExecutionDetailsMapper } from '@/routes/transactions/mappers/multisig-transactions/multisig-transaction-execution-details.mapper';
import {
  encodeAbiParameters,
  getAddress,
  keccak256,
  parseAbiParameters,
} from 'viem';

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
        proposer: new AddressInfo(transaction.proposer!),
        proposedByDelegate: null,
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
        proposer: new AddressInfo(transaction.proposer!),
        proposedByDelegate: null,
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
        proposer: new AddressInfo(transaction.proposer!),
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
        proposedByDelegate: new AddressInfo(delegate),
      }),
    );
  });

  describe('domainHash', () => {
    it.each(['0.1.0', '1.0.0', '1.1.0', '1.1.1', '1.2.0'])(
      'should return domain hash for version %s',
      async (version) => {
        // keccak256("EIP712Domain(address verifyingContract)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v1.2.0/contracts/GnosisSafe.sol#L23-L26
        const DOMAIN_TYPEHASH =
          '0x035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();
        safeRepository.getMultisigTransactions.mockResolvedValue(
          pageBuilder<MultisigTransaction>().with('results', []).build(),
        );

        const actual = await mapper.mapMultisigExecutionDetails(
          chainId,
          transaction,
          safe,
        );

        expect(actual).toEqual(
          expect.objectContaining({
            type: 'MULTISIG',
            domainHash: keccak256(
              encodeAbiParameters(parseAbiParameters('bytes32, address'), [
                DOMAIN_TYPEHASH,
                getAddress(safe.address),
              ]),
            ),
          }),
        );
      },
    );

    it.each(['1.3.0', '1.4.0', '1.4.1'])(
      'should return chainId-based domain hash for version %s',
      async (version) => {
        // keccak256("EIP712Domain(uint256 chainId,address verifyingContract)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v1.3.0/contracts/GnosisSafe.sol#L35-L38
        const DOMAIN_TYPEHASH =
          '0x47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();
        safeRepository.getMultisigTransactions.mockResolvedValue(
          pageBuilder<MultisigTransaction>().with('results', []).build(),
        );

        const actual = await mapper.mapMultisigExecutionDetails(
          chainId,
          transaction,
          safe,
        );

        expect(actual).toEqual(
          expect.objectContaining({
            type: 'MULTISIG',
            domainHash: keccak256(
              encodeAbiParameters(
                parseAbiParameters('bytes32, uint256, address'),
                [DOMAIN_TYPEHASH, BigInt(chainId), getAddress(safe.address)],
              ),
            ),
          }),
        );
      },
    );

    it('should return null domain hash if safe version is null', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().with('version', null).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .build();
      safeRepository.getMultisigTransactions.mockResolvedValue(
        pageBuilder<MultisigTransaction>().with('results', []).build(),
      );

      const actual = await mapper.mapMultisigExecutionDetails(
        chainId,
        transaction,
        safe,
      );

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'MULTISIG',
          domainHash: null,
        }),
      );
    });
  });

  describe('messageHash', () => {
    it.each(['0.1.0'])(
      'should return dataGas-based SafeTx hash for version %s',
      async (version) => {
        // keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 dataGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v0.1.0/contracts/GnosisSafe.sol#L25-L28
        const SAFE_TX_TYPEHASH =
          '0x14d461bc7412367e924637b363c7bf29b8f47e2f84869f4426e5633d8af47b20';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();
        safeRepository.getMultisigTransactions.mockResolvedValue(
          pageBuilder<MultisigTransaction>().with('results', []).build(),
        );

        const actual = await mapper.mapMultisigExecutionDetails(
          chainId,
          transaction,
          safe,
        );

        if (
          !transaction.data ||
          !transaction.safeTxGas ||
          !transaction.baseGas ||
          !transaction.gasPrice ||
          !transaction.gasToken ||
          !transaction.refundReceiver
        ) {
          // Appease TypeScript
          throw new Error('Missing transaction data');
        }

        expect(actual).toEqual(
          expect.objectContaining({
            type: 'MULTISIG',
            messageHash: keccak256(
              encodeAbiParameters(
                parseAbiParameters(
                  'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
                ),
                [
                  SAFE_TX_TYPEHASH,
                  getAddress(transaction.to),
                  BigInt(transaction.value),
                  // EIP-712 expects bytes to be hashed
                  keccak256(transaction.data),
                  transaction.operation,
                  BigInt(transaction.safeTxGas),
                  BigInt(transaction.baseGas),
                  BigInt(transaction.gasPrice),
                  getAddress(transaction.gasToken),
                  getAddress(transaction.refundReceiver),
                  BigInt(transaction.nonce),
                ],
              ),
            ),
          }),
        );
      },
    );

    it.each(['1.0.0', '1.1.0', '1.1.1', '1.2.0', '1.3.0', '1.4.0', '1.4.1'])(
      'should return baseGas-based SafeTx hash for version %s',
      async (version) => {
        // keccak256("SafeTx(address to,uint256 value,bytes data,uint8 operation,uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,address refundReceiver,uint256 nonce)");
        // @see https://github.com/safe-global/safe-smart-account/blob/v1.0.0/contracts/GnosisSafe.sol#L25-L28
        const SAFE_TX_TYPEHASH =
          '0xbb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8';

        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', version).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .build();
        safeRepository.getMultisigTransactions.mockResolvedValue(
          pageBuilder<MultisigTransaction>().with('results', []).build(),
        );

        const actual = await mapper.mapMultisigExecutionDetails(
          chainId,
          transaction,
          safe,
        );

        if (
          !transaction.data ||
          !transaction.safeTxGas ||
          !transaction.baseGas ||
          !transaction.gasPrice ||
          !transaction.gasToken ||
          !transaction.refundReceiver
        ) {
          // Appease TypeScript
          throw new Error('Missing transaction data');
        }

        expect(actual).toEqual(
          expect.objectContaining({
            type: 'MULTISIG',
            messageHash: keccak256(
              encodeAbiParameters(
                parseAbiParameters(
                  'bytes32, address, uint256, bytes32, uint8, uint256, uint256, uint256, address, address, uint256',
                ),
                [
                  SAFE_TX_TYPEHASH,
                  getAddress(transaction.to),
                  BigInt(transaction.value),
                  // EIP-712 expects bytes to be hashed
                  keccak256(transaction.data),
                  transaction.operation,
                  BigInt(transaction.safeTxGas),
                  BigInt(transaction.baseGas),
                  BigInt(transaction.gasPrice),
                  getAddress(transaction.gasToken),
                  getAddress(transaction.refundReceiver),
                  BigInt(transaction.nonce),
                ],
              ),
            ),
          }),
        );
      },
    );

    it.each([
      'data' as const,
      'safeTxGas' as const,
      'baseGas' as const,
      'gasPrice' as const,
      'gasToken' as const,
      'refundReceiver' as const,
    ])(
      'should return null SafeTx hash if transaction %s is null',
      async (field) => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().with('version', null).build();
        const transaction = multisigTransactionBuilder()
          .with('safe', safe.address)
          .with(field, null)
          .build();
        safeRepository.getMultisigTransactions.mockResolvedValue(
          pageBuilder<MultisigTransaction>().with('results', []).build(),
        );

        const actual = await mapper.mapMultisigExecutionDetails(
          chainId,
          transaction,
          safe,
        );

        expect(actual).toEqual(
          expect.objectContaining({
            type: 'MULTISIG',
            messageHash: null,
          }),
        );
      },
    );

    it('should return null SafeTx hash if safe version is null', async () => {
      const chainId = faker.string.numeric();
      const safe = safeBuilder().with('version', null).build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .build();
      safeRepository.getMultisigTransactions.mockResolvedValue(
        pageBuilder<MultisigTransaction>().with('results', []).build(),
      );

      const actual = await mapper.mapMultisigExecutionDetails(
        chainId,
        transaction,
        safe,
      );

      expect(actual).toEqual(
        expect.objectContaining({
          type: 'MULTISIG',
          messageHash: null,
        }),
      );
    });
  });
});
