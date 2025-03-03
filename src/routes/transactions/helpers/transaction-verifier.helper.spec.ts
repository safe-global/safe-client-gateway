import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { concat, getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { multisigTransactionBuilder } from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { proposeTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/propose-transaction.dto.builder';
import { TransactionVerifierHelper } from '@/routes/transactions/helpers/transaction-verifier.helper';
import { HttpExceptionWithLog } from '@/domain/common/errors/http-exception-with-log.errors';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { DelegatesV2Repository } from '@/domain/delegate/v2/delegates.v2.repository';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Delegate } from '@/domain/delegate/entities/delegate.entity';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockDelegatesRepository = jest.mocked({
  getDelegates: jest.fn(),
} as jest.MockedObjectDeep<DelegatesV2Repository>);

const mockLoggingRepository = jest.mocked({
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('TransactionVerifierHelper', () => {
  let target: TransactionVerifierHelper;

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

    target = new TransactionVerifierHelper(
      mockConfigurationService,
      mockDelegatesRepository,
      mockLoggingRepository,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    initTarget({ ethSign: true, blocklist: [] });
  });

  describe('verifyApiTransaction', () => {
    describe('safeTxHash verification', () => {
      it('should validate a valid safeTxHash', async () => {
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

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should not validate historical transactions', async () => {
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
        // @ts-expect-error - data is hex
        transaction.data = faker.number.int();

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should not validate queued transactions with a nonce lower than the Safe', async () => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        const nonce = faker.number.int({ min: 1, max: 5 });
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .with('nonce', nonce)
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', true)
          .with('nonce', nonce - 1)
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

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should throw if safeTxHash could not be calculated', async () => {
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

        await expect(() => {
          return target.verifyApiTransaction({ chainId, safe, transaction });
        }).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Could not calculate safeTxHash',
            log: false,
          }),
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
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should throw if safeTxHash is invalid', async () => {
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

        await expect(() => {
          return target.verifyApiTransaction({ chainId, safe, transaction });
        }).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Invalid safeTxHash',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenCalledWith({
          message: 'safeTxHash does not match',
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
        });
      });
    });

    describe('signature verification', () => {
      it('should validate a confirmation', async () => {
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

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it.each([
        SignatureType.ApprovedHash as const,
        SignatureType.ContractSignature as const,
      ])('should validate a %s signature', async (signatureType) => {
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
        transaction.confirmations![0].signatureType = signatureType;

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should validate multiple confirmations', async () => {
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
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 2,
              max: signers.length,
            }),
            safe,
          });

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should not validate confirmations if there are none', async () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: [],
            safe,
          });
        transaction.confirmations = null;

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should not validate confirmations if they are empty', async () => {
        const chainId = faker.string.numeric();
        const safe = safeBuilder().build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers: [],
            safe,
          });
        transaction.confirmations = [];

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should not validate historical transactions', async () => {
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
            // Duplicate owners
            signers: [signer, signer],
            safe,
          });

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should not validate queued transactions with a nonce lower than the Safe', async () => {
        const chainId = faker.string.numeric();
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);
        const nonce = faker.number.int({ min: 1, max: 5 });
        const safe = safeBuilder()
          .with('owners', [signer.address])
          .with('nonce', nonce)
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', true)
          .with('nonce', nonce - 1)
          .buildWithConfirmations({
            chainId,
            // Duplicate owners
            signers: [signer, signer],
            safe,
          });

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).resolves.not.toThrow();
      });

      it('should throw if there are duplicate owners in confirmations', async () => {
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
            signers: [signer, signer],
            safe,
          });

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Duplicate owners in confirmations',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Duplicate owners in confirmations',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          confirmations: transaction.confirmations,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should throw if there are duplicate signatures in confirmations', async () => {
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
          .with('isExecuted', false)
          .with('nonce', safe.nonce)
          .buildWithConfirmations({
            chainId,
            signers,
            safe,
          });
        transaction.confirmations![1].signature =
          transaction.confirmations![0].signature;

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Duplicate signatures in confirmations',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Duplicate signatures in confirmations',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          confirmations: transaction.confirmations,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it.each([SignatureType.Eoa as const, SignatureType.EthSign as const])(
        'should throw if an address cannot be recovered from an %s signature',
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
          const v = faker.helpers.arrayElement(
            signatureType === SignatureType.Eoa ? [27, 28] : [31, 32],
          );
          transaction.confirmations![0].signature = `0x--------------------------------------------------------------------------------------------------------------------------------${v.toString(16)}`;
          await expect(
            target.verifyApiTransaction({ chainId, safe, transaction }),
          ).rejects.toThrow(
            new HttpExceptionWithLog({
              code: HttpStatus.BAD_GATEWAY,
              message: 'Could not recover address',
              log: false,
            }),
          );

          expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
          expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
            message: 'Could not recover address',
            chainId,
            safeAddress: safe.address,
            safeVersion: safe.version,
            safeTxHash: transaction.safeTxHash,
            signature: transaction.confirmations![0].signature,
            type: 'TRANSACTION_VALIDITY',
          });
        },
      );

      it('should throw if the signature does not match the confirmation owner', async () => {
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

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Invalid signature',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Recovered address does not match signer',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signerAddress: transaction.confirmations![0].owner,
          signature: transaction.confirmations![0].signature,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should throw if the signature is not of a Safe owner', async () => {
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

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Invalid signature',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Recovered address does not match signer',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signerAddress: transaction.confirmations![0].owner,
          signature: transaction.confirmations![0].signature,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should block eth_sign', async () => {
        initTarget({ ethSign: false, blocklist: [] });

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
            signatureType: SignatureType.EthSign,
          });

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'eth_sign is disabled',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      });

      it('should block addresses in the blocklist', async () => {
        const chainId = faker.string.numeric();
        const blockedPrivateKey = generatePrivateKey();
        const blockedSigner = privateKeyToAccount(blockedPrivateKey);
        const legitPrivateKey = generatePrivateKey();
        const legitSigner = privateKeyToAccount(legitPrivateKey);
        initTarget({
          ethSign: true,
          blocklist: [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
            getAddress(blockedSigner.address),
          ],
        });
        const safe = safeBuilder()
          .with('owners', [blockedSigner.address, legitSigner.address])
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .with('nonce', faker.number.int({ min: safe.nonce }))
          .buildWithConfirmations({
            chainId,
            signers: [blockedSigner, legitSigner],
            safe,
          });

        await expect(
          target.verifyApiTransaction({ chainId, safe, transaction }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.BAD_GATEWAY,
            message: 'Unauthorized address',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      });
    });
  });

  describe('verifyProposal', () => {
    describe('safeTxHash verification', () => {
      it('should validate a valid safeTxHash', async () => {
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
          target.verifyProposal({ chainId, safe, proposal }),
        ).resolves.not.toThrow();
      });

      it('should throw if safeTxHash could not be calculated', async () => {
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
          .with('data', faker.number.int() as unknown as `0x${string}`)
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
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Could not calculate safeTxHash',
            log: false,
          }),
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
            data: proposal.data,
            operation: transaction.operation,
            safeTxGas: transaction.safeTxGas,
            baseGas: transaction.baseGas,
            gasPrice: transaction.gasPrice,
            gasToken: transaction.gasToken,
            refundReceiver: transaction.refundReceiver,
            nonce: transaction.nonce,
          },
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should throw if safeTxHash is invalid', async () => {
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
          .with(
            'safeTxHash',
            faker.string.hexadecimal({
              length: 64,
            }) as `0x${string}`,
          )
          .with('sender', transaction.confirmations![0].owner)
          .with('signature', transaction.confirmations![0].signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Invalid safeTxHash',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'safeTxHash does not match',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: proposal.safeTxHash,
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
        });
      });
    });

    describe('signature verification', () => {
      it('should validate an owner signature', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
        }
        const confirmation = faker.helpers.arrayElement(
          transaction.confirmations,
        );
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
          .with('sender', confirmation.owner)
          .with('signature', confirmation.signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).resolves.not.toThrow();
      });

      it.each([
        SignatureType.ApprovedHash as const,
        SignatureType.ContractSignature as const,
      ])('should validate a %s signature', async (signatureType) => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers),
            safe,
          });
        transaction.confirmations![0].signatureType = signatureType;
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
        }
        const confirmation = transaction.confirmations[0];
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
          .with('sender', confirmation.owner)
          .with('signature', confirmation.signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).resolves.not.toThrow();
      });

      it('should validate a delegate signature', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
        }
        const confirmation = faker.helpers.arrayElement(
          transaction.confirmations,
        );
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
          .with('sender', confirmation.owner)
          .with('signature', confirmation.signature)
          .build();
        safe.owners = [getAddress(faker.finance.ethereumAddress())];
        mockDelegatesRepository.getDelegates.mockResolvedValue(
          pageBuilder<Delegate>()
            .with('results', [
              delegateBuilder().with('delegate', confirmation.owner).build(),
            ])
            .build(),
        );

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).resolves.not.toThrow();
      });

      it('should validate concatenated signatures', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 2,
              max: signers.length,
            }),
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length < 2
        ) {
          throw new Error('Transaction must have at least 2 confirmations');
        }
        const sender = transaction.confirmations[1].owner;
        const signature = concat(
          transaction.confirmations.map(({ signature }) => signature!),
        );
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
          .with('sender', sender)
          .with('signature', signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).resolves.not.toThrow();
      });

      it('should throw if the signature is an invalid length', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
        }
        const confirmation = faker.helpers.arrayElement(
          transaction.confirmations,
        );
        confirmation.signature = '0xinvalid';
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
          .with('sender', confirmation.owner)
          .with('signature', confirmation.signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Could not recover address',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Could not recover address',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signature: confirmation.signature,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it.each([SignatureType.Eoa as const, SignatureType.EthSign as const])(
        'should throw if an an address cannot be recovered from an %s signature',
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
            .buildWithConfirmations({
              chainId,
              signers: faker.helpers.arrayElements(signers, {
                min: 1,
                max: signers.length,
              }),
              safe,
              signatureType,
            });
          if (
            !transaction.confirmations ||
            transaction.confirmations.length === 0
          ) {
            throw new Error('Transaction must have at least 1 confirmation');
          }
          const confirmation = faker.helpers.arrayElement(
            transaction.confirmations,
          );
          const v = faker.helpers.arrayElement(
            signatureType === SignatureType.Eoa ? [27, 28] : [31, 32],
          );
          confirmation.signature = `0x--------------------------------------------------------------------------------------------------------------------------------${v.toString(16)}`;
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
            .with('sender', confirmation.owner)
            .with('signature', confirmation.signature)
            .build();

          await expect(
            target.verifyProposal({ chainId, safe, proposal }),
          ).rejects.toThrow(
            new HttpExceptionWithLog({
              code: HttpStatus.UNPROCESSABLE_ENTITY,
              message: 'Could not recover address',
              log: false,
            }),
          );

          expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
          expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
            message: 'Could not recover address',
            chainId,
            safeAddress: safe.address,
            safeVersion: safe.version,
            safeTxHash: transaction.safeTxHash,
            signature: confirmation.signature,
            type: 'TRANSACTION_VALIDITY',
          });
        },
      );

      it('should throw if the signature does not match the sender', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
        }
        const confirmation = faker.helpers.arrayElement(
          transaction.confirmations,
        );
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
          .with('signature', confirmation.signature)
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Invalid signature',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Recovered address does not match signer',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signerAddress: proposal.sender,
          signature: proposal.signature,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should throw it not all individual signatures, after being split, are from owners or delegates', async () => {
        const chainId = faker.string.numeric();
        const signers = Array.from({ length: 4 }, () => {
          const privateKey = generatePrivateKey();
          return privateKeyToAccount(privateKey);
        });
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .buildWithConfirmations({
            chainId,
            signers,
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length < 2
        ) {
          throw new Error('Transaction must have at least 2 confirmations');
        }
        const sender =
          transaction.confirmations[transaction.confirmations.length - 1].owner;
        safe.owners.pop();
        const signature = concat(
          transaction.confirmations.map(({ signature }) => signature!),
        );
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
          .with('sender', sender)
          .with('signature', signature)
          .build();
        mockDelegatesRepository.getDelegates.mockResolvedValue(
          pageBuilder<Delegate>().with('results', []).build(),
        );

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Invalid signature',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Recovered address does not match signer',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signerAddress: proposal.sender,
          signature: proposal.signature,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should not throw if the signature is not from an owner or a delegate', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
        }
        const confirmation = faker.helpers.arrayElement(
          transaction.confirmations,
        );
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
          .with('sender', confirmation.owner)
          .with('signature', confirmation.signature)
          .build();
        safe.owners = [getAddress(faker.finance.ethereumAddress())];
        mockDelegatesRepository.getDelegates.mockResolvedValue(
          pageBuilder<Delegate>().with('results', []).build(),
        );

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Invalid signature',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Recovered address does not match signer',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signerAddress: proposal.sender,
          signature: proposal.signature,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should block addresses in the blocklist', async () => {
        const chainId = faker.string.numeric();
        const signers = Array.from(
          { length: faker.number.int({ min: 1, max: 5 }) },
          () => {
            const privateKey = generatePrivateKey();
            return privateKeyToAccount(privateKey);
          },
        );
        signers.push(privateKeyToAccount(generatePrivateKey()));
        // Last signer is blocked
        const blockedAddress = getAddress(signers[signers.length - 1].address);
        initTarget({
          ethSign: true,
          blocklist: [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
            blockedAddress,
            getAddress(faker.finance.ethereumAddress()),
          ],
        });
        const safe = safeBuilder()
          .with(
            'owners',
            signers.map((s) => s.address),
          )
          .build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .buildWithConfirmations({
            chainId,
            signers,
            safe,
          });
        if (
          !transaction.confirmations ||
          transaction.confirmations.length === 0
        ) {
          throw new Error('Transaction must have at least 1 confirmation');
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
          .with('sender', blockedAddress)
          // Use the last signer's signature
          .with(
            'signature',
            transaction.confirmations[transaction.confirmations.length - 1]
              .signature,
          )
          .build();

        await expect(
          target.verifyProposal({ chainId, safe, proposal }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Unauthorized address',
            log: false,
          }),
        );
      });
    });

    it('should block eth_sign', async () => {
      initTarget({ ethSign: false, blocklist: [] });

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
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
          signatureType: SignatureType.EthSign,
        });
      if (
        !transaction.confirmations ||
        transaction.confirmations.length === 0
      ) {
        throw new Error('Transaction must have at least 1 confirmation');
      }
      const confirmation = faker.helpers.arrayElement(
        transaction.confirmations,
      );
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
        .with('sender', confirmation.owner)
        .with('signature', confirmation.signature)
        .build();

      await expect(
        target.verifyProposal({ chainId, safe, proposal }),
      ).rejects.toThrow(
        new HttpExceptionWithLog({
          code: HttpStatus.UNPROCESSABLE_ENTITY,
          message: 'eth_sign is disabled',
          log: false,
        }),
      );

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
    });
  });

  describe('verifyConfirmation', () => {
    describe('safeTxHash verification', () => {
      it('should validate a valid safeTxHash', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });

        await expect(
          target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          }),
        ).resolves.not.toThrow();
      });

      it('should throw if safeTxHash could not be calculated', async () => {
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

        await expect(() => {
          return target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          });
        }).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Could not calculate safeTxHash',
            log: false,
          }),
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
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should throw if safeTxHash is invalid', async () => {
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

        await expect(() => {
          return target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          });
        }).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Invalid safeTxHash',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenCalledWith({
          message: 'safeTxHash does not match',
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
        });
      });
    });

    describe('signature verification', () => {
      it('should validate a signature', async () => {
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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
          });

        await expect(
          target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          }),
        ).resolves.not.toThrow();
      });

      it.each([
        SignatureType.ApprovedHash as const,
        SignatureType.ContractSignature as const,
      ])('should validate a %s signature', async (signatureType) => {
        const chainId = faker.string.numeric();
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);
        const safe = safeBuilder().with('owners', [signer.address]).build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .buildWithConfirmations({
            chainId,
            signers: [signer],
            safe,
          });
        transaction.confirmations![0].signatureType = signatureType;

        await expect(
          target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          }),
        ).resolves.not.toThrow();
      });

      it.each([SignatureType.Eoa as const, SignatureType.EthSign as const])(
        'should throw if an an address cannot be recovered from an %s signature',
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
            .buildWithConfirmations({
              chainId,
              signers: faker.helpers.arrayElements(signers, {
                min: 1,
                max: signers.length,
              }),
              safe,
            });
          const v = faker.helpers.arrayElement(
            signatureType === SignatureType.Eoa ? [27, 28] : [31, 32],
          );
          transaction.confirmations![0].signature = `0x--------------------------------------------------------------------------------------------------------------------------------${v.toString(16)}`;

          await expect(
            target.verifyConfirmation({
              chainId,
              safe,
              transaction,
              signature: transaction.confirmations![0].signature,
            }),
          ).rejects.toThrow(
            new HttpExceptionWithLog({
              code: HttpStatus.UNPROCESSABLE_ENTITY,
              message: 'Could not recover address',
              log: false,
            }),
          );

          expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
          expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
            message: 'Could not recover address',
            chainId,
            safeAddress: safe.address,
            safeVersion: safe.version,
            safeTxHash: transaction.safeTxHash,
            signature: transaction.confirmations![0].signature,
            type: 'TRANSACTION_VALIDITY',
          });
        },
      );

      it('should throw if the signature is not from an owner', async () => {
        const chainId = faker.string.numeric();
        const privateKey = generatePrivateKey();
        const signer = privateKeyToAccount(privateKey);
        const safe = safeBuilder().with('owners', [signer.address]).build();
        const transaction = await multisigTransactionBuilder()
          .with('safe', safe.address)
          .with('isExecuted', false)
          .buildWithConfirmations({
            chainId,
            signers: [signer],
            safe,
          });
        safe.owners = [getAddress(faker.finance.ethereumAddress())];

        await expect(
          target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'Invalid signature',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
        expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
          message: 'Recovered address does not match signer',
          chainId,
          safeAddress: safe.address,
          safeVersion: safe.version,
          safeTxHash: transaction.safeTxHash,
          signerAddress: signer.address,
          signature: transaction.confirmations![0].signature!,
          type: 'TRANSACTION_VALIDITY',
        });
      });

      it('should block eth_sign', async () => {
        initTarget({ ethSign: false, blocklist: [] });

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
          .buildWithConfirmations({
            chainId,
            signers: faker.helpers.arrayElements(signers, {
              min: 1,
              max: signers.length,
            }),
            safe,
            signatureType: SignatureType.EthSign,
          });

        await expect(
          target.verifyConfirmation({
            chainId,
            safe,
            transaction,
            signature: transaction.confirmations![0].signature!,
          }),
        ).rejects.toThrow(
          new HttpExceptionWithLog({
            code: HttpStatus.UNPROCESSABLE_ENTITY,
            message: 'eth_sign is disabled',
            log: false,
          }),
        );

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      });
    });
  });
});
