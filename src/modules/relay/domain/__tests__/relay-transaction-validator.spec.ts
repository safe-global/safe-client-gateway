// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { Hex } from 'viem';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import { RelayTransactionValidator } from '@/modules/relay/domain/relay-transaction-validator';
import {
  erc20TransferEncoder,
  erc20TransferFromEncoder,
} from '@/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import {
  execTransactionEncoder,
  addOwnerWithThresholdEncoder,
  removeOwnerEncoder,
  swapOwnerEncoder,
  changeThresholdEncoder,
  setupEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import { createProxyWithNonceEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import {
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
  getSafeSingletonDeployments,
  getSafeL2SingletonDeployments,
} from '@/domain/common/utils/deployments';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';
import configuration from '@/config/entities/configuration';
import { getDeploymentVersionsByChainIds } from '@/__tests__/deployments.helper';
import type { ILoggingService } from '@/logging/logging.interface';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';
import type { IBlockchainApiManager } from '@/domain/interfaces/blockchain-api.manager.interface';
import type { PublicClient } from 'viem';
import {
  execTransactionFromModuleEncoder,
  executeNextTxEncoder,
} from '@/modules/alerts/domain/contracts/__tests__/encoders/delay-modifier-encoder.builder';

const supportedChainIds = Object.keys(configuration().relay.apiKey);

// Record<chainId, version[]>
const PROXY_FACTORY_VERSIONS = getDeploymentVersionsByChainIds(
  'ProxyFactory',
  supportedChainIds,
);
const MULTI_SEND_CALL_ONLY_VERSIONS = getDeploymentVersionsByChainIds(
  'MultiSendCallOnly',
  supportedChainIds,
);
const MULTI_SEND_VERSIONS = getDeploymentVersionsByChainIds(
  'MultiSend',
  supportedChainIds,
);

const mockLoggingService = jest.mocked({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockSafeRepository = jest.mocked({
  getSafe: jest.fn(),
  getSafesByModule: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>);

const mockBlockchainApiManager = jest.mocked({
  getApi: jest.fn(),
  destroyApi: jest.fn(),
} as jest.MockedObjectDeep<IBlockchainApiManager>);

describe('RelayTransactionValidator', () => {
  let validator: RelayTransactionValidator;

  beforeEach(() => {
    jest.resetAllMocks();

    validator = new RelayTransactionValidator(
      mockSafeRepository,
      mockLoggingService,
      mockBlockchainApiManager,
      new Erc20Decoder(),
      new SafeDecoder(),
      new MultiSendDecoder(mockLoggingService),
      new ProxyFactoryDecoder(),
      new DelayModifierDecoder(),
    );
  });

  describe('isValidExecTransactionCall', () => {
    it('should return true for an ERC-20 transfer to a third party', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('data', erc20TransferEncoder().with('to', recipient).encode())
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(true);
    });

    it('should return false for an ERC-20 transfer back to the Safe itself', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('data', erc20TransferEncoder().with('to', safeAddress).encode())
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(false);
    });

    it('should return true for ERC-20 transferFrom where sender != recipient != Safe', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const sender = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with(
          'data',
          erc20TransferFromEncoder()
            .with('sender', sender)
            .with('recipient', recipient)
            .encode(),
        )
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(true);
    });

    it('should return false for ERC-20 transferFrom where recipient is the Safe', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const sender = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with(
          'data',
          erc20TransferFromEncoder()
            .with('sender', sender)
            .with('recipient', safeAddress)
            .encode(),
        )
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(false);
    });

    it('should return false for ERC-20 transferFrom where sender equals recipient', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const sameAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with(
          'data',
          erc20TransferFromEncoder()
            .with('sender', sameAddress)
            .with('recipient', sameAddress)
            .encode(),
        )
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(false);
    });

    it('should return true for a call to a third party (non-Safe) address', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const thirdParty = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder().with('to', thirdParty).encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(true);
    });

    it('should return false for a self-call with non-zero value', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('value', BigInt(1))
        .with('data', '0x')
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(false);
    });

    it('should return true for a cancellation (0x data, 0 value, to self)', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('value', BigInt(0))
        .with('data', '0x')
        .encode();

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data }),
      ).toBe(true);
    });

    it.each([
      ['addOwnerWithThreshold', addOwnerWithThresholdEncoder],
      ['removeOwner', removeOwnerEncoder],
      ['swapOwner', swapOwnerEncoder],
      ['changeThreshold', changeThresholdEncoder],
    ])(
      'should return true for a Safe owner management call (%s) to self',
      (_, encoderFn) => {
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const data = execTransactionEncoder()
          .with('to', safeAddress)
          .with('value', BigInt(0))
          .with('data', encoderFn().encode())
          .encode();

        expect(
          validator.isValidExecTransactionCall({ to: safeAddress, data }),
        ).toBe(true);
      },
    );

    it('should return false for non-execTransaction calldata', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      expect(
        validator.isValidExecTransactionCall({ to: safeAddress, data: '0x' }),
      ).toBe(false);
    });
  });

  describe('isSafeTxHashValid', () => {
    function makePublicClientMock(args: {
      nonce: bigint;
      txHash: Hex;
    }): jest.MockedObjectDeep<PublicClient> {
      const readContract = jest
        .fn()
        .mockResolvedValueOnce(args.nonce)
        .mockResolvedValueOnce(args.txHash);
      return { readContract } as unknown as jest.MockedObjectDeep<PublicClient>;
    }

    it('should return true when on-chain hash matches the provided safeTxHash', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const data = execTransactionEncoder().encode();
      const mockPublicClient = makePublicClientMock({
        nonce: BigInt(0),
        txHash: safeTxHash,
      });
      mockBlockchainApiManager.getApi.mockResolvedValue(
        mockPublicClient as unknown as PublicClient,
      );

      await expect(
        validator.isSafeTxHashValid({
          version: '1.3.0',
          chainId: faker.helpers.arrayElement(supportedChainIds),
          safeAddress,
          data,
          safeTxHash,
        }),
      ).resolves.toBe(true);
    });

    it('should return false when on-chain hash differs from provided safeTxHash', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const differentHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const data = execTransactionEncoder().encode();
      const mockPublicClient = makePublicClientMock({
        nonce: BigInt(0),
        txHash: differentHash,
      });
      mockBlockchainApiManager.getApi.mockResolvedValue(
        mockPublicClient as unknown as PublicClient,
      );

      await expect(
        validator.isSafeTxHashValid({
          version: '1.3.0',
          chainId: faker.helpers.arrayElement(supportedChainIds),
          safeAddress,
          data,
          safeTxHash,
        }),
      ).resolves.toBe(false);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('safeTxHash mismatch'),
        }),
      );
    });

    it('should return false when the RPC call fails', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const data = execTransactionEncoder().encode();
      mockBlockchainApiManager.getApi.mockRejectedValue(new Error('RPC error'));

      await expect(
        validator.isSafeTxHashValid({
          version: '1.3.0',
          chainId: faker.helpers.arrayElement(supportedChainIds),
          safeAddress,
          data,
          safeTxHash,
        }),
      ).resolves.toBe(false);

      expect(mockLoggingService.error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('RPC error verifying safeTxHash'),
        }),
      );
    });

    it('should return false when data cannot be decoded as execTransaction', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;

      await expect(
        validator.isSafeTxHashValid({
          version: '1.3.0',
          chainId: faker.helpers.arrayElement(supportedChainIds),
          safeAddress,
          data: '0x',
          safeTxHash,
        }),
      ).resolves.toBe(false);

      expect(mockBlockchainApiManager.getApi).not.toHaveBeenCalled();
    });
  });

  describe('isOwnerManagementTransaction', () => {
    it.each([
      ['addOwnerWithThreshold', addOwnerWithThresholdEncoder],
      ['removeOwner', removeOwnerEncoder],
      ['swapOwner', swapOwnerEncoder],
      ['changeThreshold', changeThresholdEncoder],
    ])(
      'should return true for %s wrapped in execTransaction',
      (_, encoderFn) => {
        const data = execTransactionEncoder()
          .with('data', encoderFn().encode())
          .encode();

        expect(validator.isOwnerManagementTransaction(data)).toBe(true);
      },
    );

    it('should return false for a non-owner-management execTransaction', () => {
      const data = execTransactionEncoder()
        .with('data', erc20TransferEncoder().encode())
        .encode();

      expect(validator.isOwnerManagementTransaction(data)).toBe(false);
    });

    it('should return false for non-execTransaction calldata', () => {
      expect(validator.isOwnerManagementTransaction('0x')).toBe(false);
    });
  });

  describe('getSafeBeingRecovered', () => {
    describe.each([
      ['execTransactionFromModule', execTransactionFromModuleEncoder],
      ['executeNextTx', executeNextTxEncoder],
    ])('%s', (_, encoder) => {
      it('should return the Safe address for a valid single owner-management call', async () => {
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const moduleAddress = getAddress(faker.finance.ethereumAddress());
        const data = encoder()
          .with('to', safeAddress)
          .with(
            'data',
            execTransactionEncoder()
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode(),
          )
          .encode();

        mockSafeRepository.getSafesByModule.mockResolvedValue({
          safes: [safeAddress],
        });

        await expect(
          validator.getSafeBeingRecovered({
            version: faker.system.semver(),
            chainId: faker.helpers.arrayElement(supportedChainIds),
            to: moduleAddress,
            data,
          }),
        ).resolves.toBe(safeAddress);
      });

      it('should return null for a non-owner-management call', async () => {
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const moduleAddress = getAddress(faker.finance.ethereumAddress());
        const data = encoder()
          .with('to', safeAddress)
          .with('data', execTransactionEncoder().encode())
          .encode();

        mockSafeRepository.getSafesByModule.mockResolvedValue({
          safes: [safeAddress],
        });

        await expect(
          validator.getSafeBeingRecovered({
            version: faker.system.semver(),
            chainId: faker.helpers.arrayElement(supportedChainIds),
            to: moduleAddress,
            data,
          }),
        ).resolves.toBeNull();
      });

      it('should return null when the module is not enabled on the Safe', async () => {
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const moduleAddress = getAddress(faker.finance.ethereumAddress());
        const data = encoder()
          .with('to', safeAddress)
          .with(
            'data',
            execTransactionEncoder()
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode(),
          )
          .encode();

        mockSafeRepository.getSafesByModule.mockResolvedValue({ safes: [] });

        await expect(
          validator.getSafeBeingRecovered({
            version: faker.system.semver(),
            chainId: faker.helpers.arrayElement(supportedChainIds),
            to: moduleAddress,
            data,
          }),
        ).resolves.toBeNull();
      });
    });

    it('should return null for non-DelayModifier calldata', async () => {
      await expect(
        validator.getSafeBeingRecovered({
          version: faker.system.semver(),
          chainId: faker.helpers.arrayElement(supportedChainIds),
          to: getAddress(faker.finance.ethereumAddress()),
          data: '0x',
        }),
      ).resolves.toBeNull();

      expect(mockSafeRepository.getSafesByModule).not.toHaveBeenCalled();
    });
  });

  describe('isOfficialMultiSendDeployment', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(MULTI_SEND_CALL_ONLY_VERSIONS[chainId])(
        'should return true for official MultiSendCallOnly at version %s',
        (version) => {
          const [address] = getMultiSendCallOnlyDeployments({
            version,
            chainId,
          });

          expect(
            validator.isOfficialMultiSendDeployment({
              version,
              chainId,
              address,
            }),
          ).toBe(true);
        },
      );

      it.each(MULTI_SEND_VERSIONS[chainId])(
        'should return true for official MultiSend at version %s',
        (version) => {
          const [address] = getMultiSendDeployments({ version, chainId });

          expect(
            validator.isOfficialMultiSendDeployment({
              version,
              chainId,
              address,
            }),
          ).toBe(true);
        },
      );
    });

    it('should return false for an unofficial address', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());

      expect(
        validator.isOfficialMultiSendDeployment({
          version: faker.system.semver(),
          chainId,
          address,
        }),
      ).toBe(false);
    });
  });

  describe('isOfficialProxyFactoryDeployment', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(PROXY_FACTORY_VERSIONS[chainId])(
        'should return true for official ProxyFactory at version %s',
        (version) => {
          const [address] = getProxyFactoryDeployments({ version, chainId });

          expect(
            validator.isOfficialProxyFactoryDeployment({
              version,
              chainId,
              address,
            }),
          ).toBe(true);
        },
      );
    });

    it('should return false for an unofficial address', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());

      expect(
        validator.isOfficialProxyFactoryDeployment({
          version: faker.system.semver(),
          chainId,
          address,
        }),
      ).toBe(false);
    });
  });

  describe('isValidCreateProxyWithNonceCall', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(PROXY_FACTORY_VERSIONS[chainId])(
        'should return true for createProxyWithNonce with official L1 singleton at version %s',
        (version) => {
          const [singleton] = getSafeSingletonDeployments({ version, chainId });
          if (!singleton) return;
          const data = createProxyWithNonceEncoder()
            .with('singleton', singleton)
            .encode();

          expect(
            validator.isValidCreateProxyWithNonceCall({
              version,
              chainId,
              data,
            }),
          ).toBe(true);
        },
      );

      it.each(PROXY_FACTORY_VERSIONS[chainId])(
        'should return true for createProxyWithNonce with official L2 singleton at version %s',
        (version) => {
          const [singleton] = getSafeL2SingletonDeployments({
            version,
            chainId,
          });
          if (!singleton) return;
          const data = createProxyWithNonceEncoder()
            .with('singleton', singleton)
            .encode();

          expect(
            validator.isValidCreateProxyWithNonceCall({
              version,
              chainId,
              data,
            }),
          ).toBe(true);
        },
      );
    });

    it('should return false for an unofficial singleton address', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = PROXY_FACTORY_VERSIONS[chainId][0];
      const data = createProxyWithNonceEncoder()
        .with('singleton', getAddress(faker.finance.ethereumAddress()))
        .encode();

      expect(
        validator.isValidCreateProxyWithNonceCall({ version, chainId, data }),
      ).toBe(false);
    });

    it('should return false for non-createProxyWithNonce calldata', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = PROXY_FACTORY_VERSIONS[chainId][0];

      expect(
        validator.isValidCreateProxyWithNonceCall({
          version,
          chainId,
          data: '0x',
        }),
      ).toBe(false);
    });
  });

  describe('isOfficialMastercopy', () => {
    it('should return true when the Safe repository resolves', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockResolvedValue(undefined as never);

      await expect(
        validator.isOfficialMastercopy({ chainId, address }),
      ).resolves.toBe(true);
    });

    it('should return false when the Safe repository rejects', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockRejectedValue(
        new Error('Not official mastercopy'),
      );

      await expect(
        validator.isOfficialMastercopy({ chainId, address }),
      ).resolves.toBe(false);
    });
  });

  describe('getSafeAddressFromMultiSend', () => {
    it('should return the common Safe address from a valid batch', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const innerTx = execTransactionEncoder()
        .with('to', getAddress(faker.finance.ethereumAddress()))
        .encode();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            { to: safeAddress, value: BigInt(0), data: innerTx, operation: 0 },
            { to: safeAddress, value: BigInt(0), data: innerTx, operation: 0 },
          ]),
        )
        .encode();

      expect(validator.getSafeAddressFromMultiSend(data)).toBe(safeAddress);
    });

    it('should throw InvalidMultiSendError when transactions target different addresses', () => {
      const innerTx = execTransactionEncoder().encode();
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              to: getAddress(faker.finance.ethereumAddress()),
              value: BigInt(0),
              data: innerTx,
              operation: 0,
            },
            {
              to: getAddress(faker.finance.ethereumAddress()),
              value: BigInt(0),
              data: innerTx,
              operation: 0,
            },
          ]),
        )
        .encode();

      expect(() => validator.getSafeAddressFromMultiSend(data)).toThrow(
        InvalidMultiSendError,
      );
    });

    it('should throw InvalidMultiSendError when a transaction is not a valid execTransaction', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const invalidData: Hex = '0xdeadbeef';
      const data = multiSendEncoder()
        .with(
          'transactions',
          multiSendTransactionsEncoder([
            {
              to: safeAddress,
              value: BigInt(0),
              data: invalidData,
              operation: 0,
            },
          ]),
        )
        .encode();

      expect(() => validator.getSafeAddressFromMultiSend(data)).toThrow(
        InvalidMultiSendError,
      );
    });
  });

  describe('getOwnersFromCreateProxyWithNonce', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(PROXY_FACTORY_VERSIONS[chainId])(
        'should return owners from a createProxyWithNonce call with official L1 singleton at version %s',
        (version) => {
          const [singleton] = getSafeSingletonDeployments({ version, chainId });
          if (!singleton) return;
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const data = createProxyWithNonceEncoder()
            .with('singleton', singleton)
            .with('initializer', setupEncoder().with('owners', owners).encode())
            .encode();

          expect(validator.getOwnersFromCreateProxyWithNonce(data)).toEqual(
            owners,
          );
        },
      );

      it.each(PROXY_FACTORY_VERSIONS[chainId])(
        'should return owners from a createProxyWithNonce call with official L2 singleton at version %s',
        (version) => {
          const [singleton] = getSafeL2SingletonDeployments({
            version,
            chainId,
          });
          if (!singleton) return;
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const data = createProxyWithNonceEncoder()
            .with('singleton', singleton)
            .with('initializer', setupEncoder().with('owners', owners).encode())
            .encode();

          expect(validator.getOwnersFromCreateProxyWithNonce(data)).toEqual(
            owners,
          );
        },
      );
    });

    it('should throw when data is not a createProxyWithNonce call', () => {
      expect(() => validator.getOwnersFromCreateProxyWithNonce('0x')).toThrow();
    });

    it('should throw when the initializer is not a setup call', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = PROXY_FACTORY_VERSIONS[chainId][0];
      const [singleton] = getSafeSingletonDeployments({ version, chainId });
      if (!singleton) return;
      // execTransaction is a valid Safe ABI function but not 'setup'
      const data = createProxyWithNonceEncoder()
        .with('singleton', singleton)
        .with('initializer', execTransactionEncoder().encode())
        .encode();

      expect(() => validator.getOwnersFromCreateProxyWithNonce(data)).toThrow(
        'Not a setup call',
      );
    });
  });
});
