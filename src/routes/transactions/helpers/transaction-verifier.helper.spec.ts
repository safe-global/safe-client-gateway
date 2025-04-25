import { faker } from '@faker-js/faker';
import { get } from 'lodash';
import { concat, getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { proposeTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/propose-transaction.dto.builder';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { Operation } from '@/domain/safe/entities/operation.entity';
import configuration from '@/config/entities/__tests__/configuration';
import { getSignature } from '@/domain/common/utils/__tests__/signatures.builder';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { DelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';
import type { IContractsRepository } from '@/domain/contracts/contracts.repository.interface';
import { getSafeTxHash } from '@/domain/common/utils/safe';
import { confirmationBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction-confirmation.builder';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockDelegatesRepository = jest.mocked({
  getDelegates: jest.fn(),
} as jest.MockedObjectDeep<DelegatesV2Repository>);

const mockLoggingRepository = jest.mocked({
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockContractsRepository = jest.mocked({
  isTrustedForDelegateCall: jest.fn(),
} as jest.MockedObjectDeep<IContractsRepository>);

describe('TransactionVerifierHelper', () => {
  let target: TransactionVerifierHelper;

  function initTarget(config: typeof configuration): void {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      return get(config(), key);
    });

    target = new TransactionVerifierHelper(
      mockConfigurationService,
      mockDelegatesRepository,
      mockLoggingRepository,
      mockContractsRepository,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    initTarget(configuration);
  });

  describe('verifyApiTransaction', () => {
    it.each(Object.values(SignatureType))(
      'should allow a transaction with %s signature',
      async (signatureType) => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
            signatureType,
          });

        expect(() => {
          return target.verifyApiTransaction({ chainId, safe, transaction });
        }).not.toThrow();

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should allow a transaction with a mixture of signature type confirmations', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should not validate executed transactions', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', true)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      transaction.confirmations![0].signature = faker.string.hexadecimal({
        length: 130,
      }) as `0x${string}`;

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should not validate transactions with a nonce lower than the Safe', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce - 1)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      transaction.confirmations![0].signature = faker.string.hexadecimal({
        length: 130,
      }) as `0x${string}`;

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the safeTxHash could not be calculated', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      // @ts-expect-error - data is hex
      transaction.data = faker.number.int();

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).toThrow(new HttpExceptionNoLog('Could not calculate safeTxHash', 502));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Could not calculate safeTxHash',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        source: 'API',
      });
    });

    it('should throw and log if the safeTxHash does not match', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.data = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).toThrow(new HttpExceptionNoLog('Invalid safeTxHash', 502));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'safeTxHash does not match',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should allow a transaction with no confirmations', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.confirmations = null;

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should allow a transaction with empty confirmations', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.confirmations = [];

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw if a signature is not a valid hex bytes string', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 129) as `0x${string}`;

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).toThrow(new Error('Invalid hex bytes length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw if a signature length is invalid', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 128) as `0x${string}`;

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).toThrow(new Error('Invalid signature length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it.each(Object.values(SignatureType))(
      'should throw if a confirmation contains an invalid %s signature',
      async (signatureType) => {
        const chainId = faker.string.numeric();
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);
        const safe = safeBuilder().with('owners', [signer.address]).build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: [signer],
            safe,
            signatureType,
          });
        const v = transaction.confirmations![0].signature?.slice(-2);
        transaction.confirmations![0].signature = `0x${'-'.repeat(128)}${v}`;

        expect(() => {
          return target.verifyApiTransaction({ chainId, safe, transaction });
        }).toThrow(new Error('Could not recover address'));

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should throw and log if a signer is blocked', async () => {
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          blockchain: {
            ...defaultConfiguration.blockchain,
            blocklist: [signer.address],
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).toThrow(new HttpExceptionNoLog('Unauthorized address', 502));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        blockedAddress: signer.address,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should throw and log if a signer does not match the confirmation owner', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      transaction.confirmations![0].owner = getAddress(
        faker.finance.ethereumAddress(),
      );

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).toThrow(new HttpExceptionNoLog('Invalid signature', 502));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: transaction.confirmations![0].owner,
        signature: transaction.confirmations![0].signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should not block eth_sign', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
          signatureType: SignatureType.EthSign,
        });

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should not block delegate calls', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyApiTransaction({ chainId, safe, transaction });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });
  });

  describe('verifyProposal', () => {
    it.each(Object.values(SignatureType))(
      'should allow a transaction with %s signature',
      async (signatureType) => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('operation', Operation.CALL)
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
            signatureType,
          });
        const proposal = proposeTransactionDtoBuilder()
          .with('to', transaction.to)
          .with('value', transaction.value)
          .with('data', transaction.data)
          .with('nonce', transaction.nonce.toString())
          .with('operation', transaction.operation)
          .with('safeTxGas', transaction.safeTxGas!.toString())
          .with('baseGas', transaction.baseGas!.toString())
          .with('gasPrice', transaction.gasPrice!)
          .with('gasToken', transaction.gasToken!)
          .with('refundReceiver', transaction.refundReceiver)
          .with('safeTxHash', transaction.safeTxHash)
          .with('sender', transaction.confirmations![0].owner)
          .with('signature', transaction.confirmations![0].signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal, transaction }),
        ).resolves.not.toThrow();

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should allow a transaction with concatenated signatures', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 2,
            max: signers.length,
          }),
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with(
          'signature',
          concat(
            transaction.confirmations!.map(
              (confirmation) => confirmation.signature!,
            ),
          ),
        )
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).resolves.not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should allow a transaction from a delegate', async () => {
      const chainId = faker.string.numeric();
      const [delegate, ...signers] = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      const signature = await getSignature({
        signer: delegate,
        hash: transaction.safeTxHash,
        signatureType: faker.helpers.enumValue(SignatureType),
      });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', delegate.address)
        .with('signature', signature)
        .build();
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>()
          .with('results', [
            delegateBuilder().with('delegate', delegate.address).build(),
          ])
          .build(),
      );

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).resolves.not.toThrow();
    });

    it('should throw if the nonce is below that of the Safe', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce - 1)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new HttpExceptionNoLog('Invalid nonce', 422));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should allow trusted delegate calls', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            trustedDelegateCall: true,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      mockContractsRepository.isTrustedForDelegateCall.mockResolvedValue(true);

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).resolves.not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw for delegate calls by default', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            trustedDelegateCall: false,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      mockContractsRepository.isTrustedForDelegateCall.mockResolvedValue(true);

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(
        new HttpExceptionNoLog('Delegate call is disabled', 422),
      );

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw for untrusted delegate calls if only trusted delegate calls are enabled', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            trustedDelegateCall: true,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      mockContractsRepository.isTrustedForDelegateCall.mockResolvedValue(false);

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(
        new HttpExceptionNoLog('Delegate call is disabled', 422),
      );

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw for delegate calls when the contract cannot be found and only trusted delegate calls are enabled', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            trustedDelegateCall: true,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      mockContractsRepository.isTrustedForDelegateCall.mockRejectedValue(
        new Error('Contract not found'),
      );

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(
        new HttpExceptionNoLog('Delegate call is disabled', 422),
      );

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the safeTxHash could not be calculated', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      // @ts-expect-error - data is hex
      transaction.data = faker.number.int();
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(
        new HttpExceptionNoLog('Could not calculate safeTxHash', 422),
      );

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Could not calculate safeTxHash',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        source: 'PROPOSAL',
      });
    });

    it('should throw and log if the safeTxHash does not match', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.data = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new HttpExceptionNoLog('Invalid safeTxHash', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'safeTxHash does not match',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });

    it('should throw if a signature is not a valid hex bytes string', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 129) as `0x${string}`;
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new Error('Invalid hex bytes length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw if the signature length is invalid', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.confirmations![0].signature =
        transaction.confirmations![0].signature!.slice(0, 128) as `0x${string}`;
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new Error('Invalid signature length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it.each(Object.values(SignatureType))(
      'should throw if a %s signature is invalid',
      async (signatureType) => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('nonce', safe.nonce)
          .with('operation', Operation.CALL)
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
            signatureType,
          });
        const v = transaction.confirmations![0].signature?.slice(-2);
        const proposal = proposeTransactionDtoBuilder()
          .with('to', transaction.to)
          .with('value', transaction.value)
          .with('data', transaction.data)
          .with('nonce', transaction.nonce.toString())
          .with('operation', transaction.operation)
          .with('safeTxGas', transaction.safeTxGas!.toString())
          .with('baseGas', transaction.baseGas!.toString())
          .with('gasPrice', transaction.gasPrice!)
          .with('gasToken', transaction.gasToken!)
          .with('refundReceiver', transaction.refundReceiver)
          .with('safeTxHash', transaction.safeTxHash)
          .with('sender', transaction.confirmations![0].owner)
          .with('signature', `0x${'-'.repeat(128)}${v}`)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal, transaction }),
        ).rejects.toThrow(new Error('Could not recover address'));

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should throw and log if a signer is blocked', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          blockchain: {
            ...defaultConfiguration.blockchain,
            blocklist: [signers[0].address],
          },
        };
      };
      initTarget(testConfiguration);
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers,
          safe,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new HttpExceptionNoLog('Unauthorized address', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        blockedAddress: signers[0].address,
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });

    it('should throw if eth_sign is disabled', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            ethSign: false,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
          signatureType: SignatureType.EthSign,
        });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      transaction.confirmations = [];

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new HttpExceptionNoLog('eth_sign is disabled', 422));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should not throw if the eth_sign signature is an existing signature', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            ethSign: false,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .with('confirmations', [])
        .build();
      transaction.safeTxHash = getSafeTxHash({
        chainId,
        safe,
        transaction,
      });
      const ethSignSignature = await getSignature({
        signer: signers[0],
        hash: transaction.safeTxHash,
        signatureType: SignatureType.EthSign,
      });
      // First confirmation is eth_sign
      transaction.confirmations?.push(
        confirmationBuilder()
          .with('owner', signers[0].address)
          .with('signature', ethSignSignature)
          .with('signatureType', SignatureType.EthSign)
          .build(),
      );
      for (const signer of signers.slice(1)) {
        const signatureType = faker.helpers.arrayElement([
          SignatureType.ApprovedHash,
          SignatureType.ContractSignature,
          SignatureType.Eoa,
        ]);
        const signature = await getSignature({
          signer,
          hash: transaction.safeTxHash,
          signatureType,
        });
        transaction.confirmations?.push(
          confirmationBuilder()
            .with('owner', signer.address)
            .with('signature', signature)
            .with('signatureType', signatureType)
            .build(),
        );
      }
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        // Sender is the last signer
        .with('sender', transaction.confirmations!.at(-1)!.owner)
        .with(
          'signature',
          // eth_sign is included in concatenated proposal
          concat(
            transaction.confirmations!.map(
              (confirmation) => confirmation.signature!,
            ),
          ),
        )
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).resolves.not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the signer is not the sender', async () => {
      const chainId = faker.string.numeric();
      const [sender, ...signers] = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
          signatureType: SignatureType.EthSign,
        });
      const signature = await getSignature({
        signer: sender,
        hash: transaction.safeTxHash,
        signatureType: faker.helpers.enumValue(SignatureType),
      });
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', getAddress(faker.finance.ethereumAddress()))
        .with('signature', signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new HttpExceptionNoLog('Invalid signature', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: proposal.sender,
        signature: proposal.signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });

    it('should throw and log if the signers are not all owners or delegates', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('nonce', safe.nonce)
        .with('operation', Operation.CALL)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      safe.owners = [getAddress(faker.finance.ethereumAddress())];
      const proposal = proposeTransactionDtoBuilder()
        .with('to', transaction.to)
        .with('value', transaction.value)
        .with('data', transaction.data)
        .with('nonce', transaction.nonce.toString())
        .with('operation', transaction.operation)
        .with('safeTxGas', transaction.safeTxGas!.toString())
        .with('baseGas', transaction.baseGas!.toString())
        .with('gasPrice', transaction.gasPrice!)
        .with('gasToken', transaction.gasToken!)
        .with('refundReceiver', transaction.refundReceiver)
        .with('safeTxHash', transaction.safeTxHash)
        .with('sender', transaction.confirmations![0].owner)
        .with('signature', transaction.confirmations![0].signature)
        .build();
      mockDelegatesRepository.getDelegates.mockResolvedValue(
        pageBuilder<Delegate>().with('results', []).build(),
      );

      await expect(
        target.verifyProposal({ chainId, safe, proposal, transaction }),
      ).rejects.toThrow(new HttpExceptionNoLog('Invalid signature', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: proposal.sender,
        signature: proposal.signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'PROPOSAL',
      });
    });
  });

  describe('verifyConfirmation', () => {
    it.each(Object.values(SignatureType))(
      'should allow a transaction with %s signature',
      async (signatureType) => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
            signatureType,
          });

        expect(() => {
          return target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: faker.helpers.arrayElement(
              transaction.confirmations!.map((confirmation) => {
                return confirmation.signature!;
              }),
            ),
          });
        }).not.toThrow();

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should throw for executed transactions', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', true)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).toThrow(new HttpExceptionNoLog('Invalid nonce', 422));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw if the nonce is below that of the Safe', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce - 1)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).toThrow(new HttpExceptionNoLog('Invalid nonce', 422));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the safeTxHash could not be calculated', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      // @ts-expect-error - data is hex
      transaction.data = faker.number.int();

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).toThrow(new HttpExceptionNoLog('Could not calculate safeTxHash', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Could not calculate safeTxHash',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        source: 'API',
      });
    });

    it('should throw and log if the safeTxHash does not match', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      transaction.data = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).toThrow(new HttpExceptionNoLog('Invalid safeTxHash', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'safeTxHash does not match',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        transaction: {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data,
          operation: transaction.operation,
          safeTxGas: transaction.safeTxGas,
          baseGas: transaction.baseGas,
          gasPrice: transaction.gasPrice,
          gasToken: transaction.gasToken,
          refundReceiver: transaction.refundReceiver,
          nonce: transaction.nonce,
        },
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should throw if a signature is not a valid hex bytes string', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!.slice(0, 129) as `0x${string}`;
            }),
          ),
        });
      }).toThrow(new Error('Invalid hex bytes length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw if the signature length is invalid', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!.slice(0, 128) as `0x${string}`;
            }),
          ),
        });
      }).toThrow(new Error('Invalid signature length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it.each(Object.values(SignatureType))(
      'should throw if a %s signature is invalid',
      async (signatureType) => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
            signatureType,
          });
        const v = transaction.confirmations![0].signature?.slice(-2);

        expect(() => {
          return target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: `0x${'-'.repeat(128)}${v}`,
          });
        }).toThrow(new Error('Could not recover address'));

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should throw and log if a signer is blocked', async () => {
      const [blockedSigner, ...otherSigners] = Array.from(
        { length: faker.number.int({ min: 2, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          blockchain: {
            ...defaultConfiguration.blockchain,
            blocklist: [blockedSigner.address],
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const safe = safeBuilder()
        .with('owners', [
          blockedSigner.address,
          ...otherSigners.map((signer) => signer.address),
        ])
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [blockedSigner, ...otherSigners],
          safe,
        });
      // We need to remove the blocked signer from the signers array
      // so as to not be verified as an API signature
      const blockedConfirmation = transaction.confirmations![0];
      transaction.confirmations?.shift();

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: blockedConfirmation.signature!,
        });
      }).toThrow(new HttpExceptionNoLog('Unauthorized address', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        blockedAddress: blockedSigner.address,
        type: 'TRANSACTION_VALIDITY',
        source: 'CONFIRMATION',
      });
    });

    it('should throw if eth_sign is disabled', async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            ethSign: false,
          },
        };
      };
      initTarget(testConfiguration);
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
          signatureType: SignatureType.EthSign,
        });

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).toThrow(new HttpExceptionNoLog('eth_sign is disabled', 422));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });

    it('should throw and log if the signer is not an owner', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      safe.owners = [getAddress(faker.finance.ethereumAddress())];

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).toThrow(new HttpExceptionNoLog('Invalid signature', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        event: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeTxHash: transaction.safeTxHash,
        signerAddress: transaction.confirmations![0].owner,
        signature: transaction.confirmations![0].signature,
        type: 'TRANSACTION_VALIDITY',
        source: 'API',
      });
    });

    it('should not block delegate calls', async () => {
      const chainId = faker.string.numeric();
      const signers = Array.from(
        { length: faker.number.int({ min: 1, max: 5 }) },
        () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        },
      );
      const safe = safeBuilder()
        .with(
          'owners',
          signers.map((s) => s.address),
        )
        .build();
      const transaction = await multisigTransactionBuilder()
        .with('safe', safe.address)
        .with('isExecuted', false)
        .with('nonce', safe.nonce)
        .with('operation', Operation.DELEGATE)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyConfirmation({
          chainId,
          safe,
          transaction,
          signature: faker.helpers.arrayElement(
            transaction.confirmations!.map((confirmation) => {
              return confirmation.signature!;
            }),
          ),
        });
      }).not.toThrow();

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });
  });
});
