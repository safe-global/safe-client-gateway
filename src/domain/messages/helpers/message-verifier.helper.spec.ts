import { faker } from '@faker-js/faker';
import { get } from 'lodash';
import { getAddress } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { MessageVerifierHelper } from '@/domain/messages/helpers/message-verifier.helper';
import { messageBuilder } from '@/domain/messages/entities/__tests__/message.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import configuration from '@/config/entities/__tests__/configuration';
import { SignatureType } from '@/domain/common/entities/signature-type.entity';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';

const mockConfigurationService = jest.mocked({
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>);

const mockLoggingRepository = jest.mocked({
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

describe('MessageVerifierHelper', () => {
  let target: MessageVerifierHelper;

  function initTarget(config: typeof configuration): void {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      return get(config(), key);
    });

    target = new MessageVerifierHelper(
      mockConfigurationService,
      mockLoggingRepository,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();

    initTarget(configuration);
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

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
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

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
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
      message.confirmations[0].signature =
        message.confirmations[0].signature.slice(0, 129) as `0x${string}`;

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
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
      message.confirmations[0].signature =
        message.confirmations[0].signature.slice(0, 128) as `0x${string}`;

      expect(() => {
        return target.verifyCreation({
          chainId,
          safe,
          message: message.message,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new Error('Invalid signature length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
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

        expect(() => {
          return target.verifyUpdate({
            chainId,
            safe,
            message: message.message,
            messageHash: message.messageHash,
            signature: `0x${'-'.repeat(128)}${v}`,
          });
        }).toThrow(new HttpExceptionNoLog('Could not recover address', 422));

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should throw and log if the recovered address is blocked', async () => {
      const chainId = faker.string.numeric();
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
        event: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signature: message.confirmations[0].signature,
        blockedAddress: signer.address,
        type: 'MESSAGE_VALIDITY',
        source: 'PROPOSAL',
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
        event: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signerAddress: signer.address,
        signature: message.confirmations[0].signature,
        type: 'MESSAGE_VALIDITY',
        source: 'PROPOSAL',
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

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
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
        source: 'CONFIRMATION',
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

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
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
      message.confirmations[0].signature =
        message.confirmations[0].signature.slice(0, 129) as `0x${string}`;

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
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
      message.confirmations[0].signature =
        message.confirmations[0].signature.slice(0, 128) as `0x${string}`;

      expect(() => {
        return target.verifyUpdate({
          chainId,
          safe,
          message: message.message,
          messageHash: message.messageHash,
          signature: message.confirmations[0].signature,
        });
      }).toThrow(new Error('Invalid signature length'));

      expect(mockLoggingRepository.error).not.toHaveBeenCalled();
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

        expect(() => {
          return target.verifyUpdate({
            chainId,
            safe,
            message: message.message,
            messageHash: message.messageHash,
            signature: `0x${'-'.repeat(128)}${v}`,
          });
        }).toThrow(new HttpExceptionNoLog('Could not recover address', 422));

        expect(mockLoggingRepository.error).not.toHaveBeenCalled();
      },
    );

    it('should throw and log if the recovered address is blocked', async () => {
      const chainId = faker.string.numeric();
      const privateKey = generatePrivateKey();
      const signer = privateKeyToAccount(privateKey);
      const defaultConfiguration = configuration();
      const testConfiguration = (): ReturnType<typeof configuration> => {
        return {
          ...defaultConfiguration,
          features: {
            ...defaultConfiguration.features,
            ethSign: true,
          },
          blockchain: {
            ...defaultConfiguration.blockchain,
            blocklist: [signer.address],
          },
        };
      };
      initTarget(testConfiguration);
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
        event: 'Unauthorized address',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signature: message.confirmations[0].signature,
        blockedAddress: signer.address,
        type: 'MESSAGE_VALIDITY',
        source: 'CONFIRMATION',
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
        event: 'Recovered address does not match signer',
        chainId,
        safeAddress: safe.address,
        safeVersion: safe.version,
        messageHash: message.messageHash,
        signerAddress: signer.address,
        signature: message.confirmations[0].signature,
        type: 'MESSAGE_VALIDITY',
        source: 'CONFIRMATION',
      });
    });
  });
});
