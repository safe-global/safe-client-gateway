import { MessageVerifierHelper } from '@/domain/messages/helpers/message-verifier.helper';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { faker } from '@faker-js/faker/.';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import { getAddress } from 'viem';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockLoggingRepository = jest.mocked({
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('MessageVerifierHelper', () => {
  let target: MessageVerifierHelper;

  function initTarget(args: {
    ethSign: boolean;
    blocklist: Array<`0x${string}`>;
  }): void {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'blockchain.blocklist') return args.blocklist;
      return [
        'features.messageVerification',
        args.ethSign ? 'features.ethSign' : null,
      ].includes(key);
    });

    target = new MessageVerifierHelper(
      mockConfigurationService,
      mockLoggingRepository,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    initTarget({ ethSign: true, blocklist: [] });
  });

  describe('verifyCreation', () => {
    it('should not throw if the creation is valid', async () => {
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).not.toThrow();
    });

    it('should throw and log if the messageHash could not be generated', async () => {
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      safe.version = null;

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(
        new HttpExceptionNoLog('Could not calculate messageHash', 422),
      );

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Could not calculate messageHash',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeMessage: message.message,
        type: 'MESSAGE_VALIDITY',
      });
    });

    it('should throw if eth_sign is disabled', async () => {
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
      const message = await messageBuilder()
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

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('eth_sign is disabled', 422));
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      message.confirmations[0].signature += 'extra';

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new Error('Invalid signature length'));
    });

    it.each(Object.values(SignatureType))(
      'should throw if an address cannot be recovered from an %s signature',
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
        const message = await messageBuilder()
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
        const v = message.confirmations[0].signature?.slice(-2);
        message.confirmations[0].signature = `0x--------------------------------------------------------------------------------------------------------------------------------${v}`;

        expect(() => {
          return target.verifyUpdate({
            chainId,
            safe,
            message: message.message,
            messageHash: message.messageHash,
            signature: message.confirmations[0].signature,
          });
        }).toThrow(new HttpExceptionNoLog('Could not recover address', 422));
      },
    );

    it('should throw and log if the recovered address is blocked', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      initTarget({
        ethSign: true,
        blocklist: [signer.address],
      });
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('Unauthorized address', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signature: message.confirmations[0].signature,
        blockedAddress: signer.address,
        type: 'MESSAGE_VALIDITY',
      });
    });

    it('should throw and log if the recovered address is not an owner', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      safe.owners = [getAddress(faker.finance.ethereumAddress())];
      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('Invalid signature', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signerAddress: signer.address,
        signature: message.confirmations[0].signature,
        type: 'MESSAGE_VALIDITY',
      });
    });
  });

  describe('verifyUpdate', () => {
    it('should not throw if the update is valid', async () => {
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).not.toThrow();
    });

    it('should throw and log if the messageHash could not be generated', async () => {
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      safe.version = null;

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(
        new HttpExceptionNoLog('Could not calculate messageHash', 422),
      );

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Could not calculate messageHash',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        safeMessage: message.message,
        type: 'MESSAGE_VALIDITY',
      });
    });

    it('should throw and log if the messageHash does not match', async () => {
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      message.messageHash = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('Invalid messageHash', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'messageHash does not match',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        safeMessage: message.message,
        type: 'MESSAGE_VALIDITY',
      });
    });

    it('should throw if eth_sign is disabled', async () => {
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
      const message = await messageBuilder()
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

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('eth_sign is disabled', 422));
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
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: faker.helpers.arrayElements(signers, {
            min: 1,
            max: signers.length,
          }),
          safe,
        });
      message.confirmations[0].signature += 'extra';

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new Error('Invalid signature length'));
    });

    it.each(Object.values(SignatureType))(
      'should throw if an address cannot be recovered from an %s signature',
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
        const message = await messageBuilder()
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
        const v = message.confirmations[0].signature?.slice(-2);
        message.confirmations[0].signature = `0x--------------------------------------------------------------------------------------------------------------------------------${v}`;

        expect(() => {
          return target.verifyUpdate({
            chainId,
            safe,
            message: message.message,
            messageHash: message.messageHash,
            signature: message.confirmations[0].signature,
          });
        }).toThrow(new HttpExceptionNoLog('Could not recover address', 422));
      },
    );

    it('should throw and log if the recovered address is blocked', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      initTarget({
        ethSign: true,
        blocklist: [signer.address],
      });
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('Unauthorized address', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signature: message.confirmations[0].signature,
        blockedAddress: signer.address,
        type: 'MESSAGE_VALIDITY',
      });
    });

    it('should throw and log if the recovered address is not an owner', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const safe = safeBuilder().with('owners', [signer.address]).build();
      const message = await messageBuilder()
        .with('safe', safe.address)
        .buildWithConfirmations({
          chainId,
          signers: [signer],
          safe,
        });
      safe.owners = [getAddress(faker.finance.ethereumAddress())];

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new HttpExceptionNoLog('Invalid signature', 422));

      expect(mockLoggingRepository.error).toHaveBeenCalledTimes(1);
      expect(mockLoggingRepository.error).toHaveBeenNthCalledWith(1, {
        message: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signerAddress: signer.address,
        signature: message.confirmations[0].signature,
        type: 'MESSAGE_VALIDITY',
      });
    });
  });
});
