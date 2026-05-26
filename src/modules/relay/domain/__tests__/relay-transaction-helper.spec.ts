// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import { getAddress, zeroAddress } from 'viem';
import { getDeploymentVersionsByChainIds } from '@/__tests__/deployments.helper';
import configuration from '@/config/entities/configuration';
import {
  getMultiSendCallOnlyDeployments,
  getMultiSendDeployments,
  getProxyFactoryDeployments,
  getSafeL2SingletonDeployments,
  getSafeSingletonDeployments,
} from '@/domain/common/utils/deployments';
import type { ILoggingService } from '@/logging/logging.interface';
import {
  execTransactionFromModuleEncoder,
  executeNextTxEncoder,
} from '@/modules/alerts/domain/contracts/__tests__/encoders/delay-modifier-encoder.builder';
import { DelayModifierDecoder } from '@/modules/alerts/domain/contracts/decoders/delay-modifier-decoder.helper';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/multi-send-encoder.builder';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  setupEncoder,
  swapOwnerEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { MultiSendDecoder } from '@/modules/contracts/domain/decoders/multi-send-decoder.helper';
import { SafeDecoder } from '@/modules/contracts/domain/decoders/safe-decoder.helper';
import {
  erc20TransferEncoder,
  erc20TransferFromEncoder,
} from '@/modules/relay/domain/contracts/__tests__/encoders/erc20-encoder.builder';
import { createProxyWithNonceEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/proxy-factory-encoder.builder';
import { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import { ProxyFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/proxy-factory-decoder.helper';
import { SignerFactoryDecoder } from '@/modules/relay/domain/contracts/decoders/signer-factory-decoder.helper';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';
import { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import { multisigTransactionBuilder } from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import type { ISafeRepository } from '@/modules/safe/domain/safe.repository.interface';

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
const SAFE_VERSIONS = getDeploymentVersionsByChainIds(
  'Safe',
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
  getMultiSigTransaction: jest.fn(),
} as jest.MockedObjectDeep<ISafeRepository>);

describe('RelayTransactionHelper', () => {
  let helper: RelayTransactionHelper;

  beforeEach(() => {
    jest.resetAllMocks();

    helper = new RelayTransactionHelper(
      mockSafeRepository,
      mockLoggingService,
      new Erc20Decoder(),
      new SafeDecoder(),
      new MultiSendDecoder(mockLoggingService),
      new ProxyFactoryDecoder(),
      new DelayModifierDecoder(),
      new SignerFactoryDecoder(),
    );
  });

  describe('isValidExecTransactionCall', () => {
    it('should return true for an ERC-20 transfer to a third party', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const recipient = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('data', erc20TransferEncoder().with('to', recipient).encode())
        .encode();

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        true,
      );
    });

    it('should return false for an ERC-20 transfer back to the Safe itself', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('data', erc20TransferEncoder().with('to', safeAddress).encode())
        .encode();

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        false,
      );
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

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        true,
      );
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

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        false,
      );
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

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        false,
      );
    });

    it('should return true for a call to a third party (non-Safe) address', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const thirdParty = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder().with('to', thirdParty).encode();

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        true,
      );
    });

    it('should return false for a self-call with non-zero value', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('value', BigInt(1))
        .with('data', '0x')
        .encode();

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        false,
      );
    });

    it('should return true for a cancellation (0x data, 0 value, to self)', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('value', BigInt(0))
        .with('data', '0x')
        .encode();

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        true,
      );
    });

    it.each([
      ['addOwnerWithThreshold', addOwnerWithThresholdEncoder],
      ['removeOwner', removeOwnerEncoder],
      ['swapOwner', swapOwnerEncoder],
      ['changeThreshold', changeThresholdEncoder],
    ])('should return true for a Safe owner management call (%s) to self', (_, encoderFn) => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const data = execTransactionEncoder()
        .with('to', safeAddress)
        .with('value', BigInt(0))
        .with('data', encoderFn().encode())
        .encode();

      expect(helper.isValidExecTransactionCall({ to: safeAddress, data })).toBe(
        true,
      );
    });

    it('should return false for non-execTransaction calldata', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      expect(
        helper.isValidExecTransactionCall({ to: safeAddress, data: '0x' }),
      ).toBe(false);
    });
  });

  describe('isSafeTxHashValid', () => {
    // execTransactionEncoder() defaults: value=0n, data='0x', operation=0,
    // safeTxGas=baseGas=gasPrice=0n, gasToken=refundReceiver=zeroAddress.
    // We build a matching stored MultisigTransaction for happy-path tests, with
    // the `to` field aligned to the decoded payload.
    function buildMatchingStored(args: {
      safeAddress: Hex;
      decodedTo: Hex;
    }): ReturnType<typeof multisigTransactionBuilder> extends infer B
      ? B
      : never {
      return multisigTransactionBuilder()
        .with('safe', getAddress(args.safeAddress))
        .with('to', getAddress(args.decodedTo))
        .with('value', '0')
        .with('data', '0x')
        .with('operation', 0)
        .with('safeTxGas', 0)
        .with('baseGas', 0)
        .with('gasPrice', '0')
        .with('gasToken', zeroAddress)
        .with('refundReceiver', zeroAddress);
    }

    it('should return true when the tx-service stored fields match the decoded execTransaction', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const decoded = helper.decodeExecTransaction(
        execTransactionEncoder().encode(),
      )!;
      const stored = buildMatchingStored({
        safeAddress,
        decodedTo: decoded.to,
      }).build();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(stored);

      await expect(
        helper.isSafeTxHashValid({
          version,
          chainId,
          safeAddress,
          decoded,
          safeTxHash,
        }),
      ).resolves.toBe(true);
    });

    it('should return false when a stored field differs from the decoded execTransaction', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const decoded = helper.decodeExecTransaction(
        execTransactionEncoder().encode(),
      )!;
      const stored = buildMatchingStored({
        safeAddress,
        decodedTo: decoded.to,
      })
        .with('to', getAddress(faker.finance.ethereumAddress()))
        .build();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(stored);

      await expect(
        helper.isSafeTxHashValid({
          version,
          chainId,
          safeAddress,
          decoded,
          safeTxHash,
        }),
      ).resolves.toBe(false);

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('safeTxHash field mismatch'),
        }),
      );
    });

    it('should return false when the tx-service lookup fails', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const decoded = helper.decodeExecTransaction(
        execTransactionEncoder().encode(),
      )!;
      mockSafeRepository.getMultiSigTransaction.mockRejectedValue(
        new Error('Not found'),
      );

      await expect(
        helper.isSafeTxHashValid({
          version,
          chainId,
          safeAddress,
          decoded,
          safeTxHash,
        }),
      ).resolves.toBe(false);

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('tx service lookup failed'),
        }),
      );
    });

    it("should return false when the stored tx's safe address differs from the requested safe", async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const otherSafe = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const decoded = helper.decodeExecTransaction(
        execTransactionEncoder().encode(),
      )!;
      const stored = buildMatchingStored({
        safeAddress: otherSafe,
        decodedTo: decoded.to,
      }).build();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(stored);

      await expect(
        helper.isSafeTxHashValid({
          version,
          chainId,
          safeAddress,
          decoded,
          safeTxHash,
        }),
      ).resolves.toBe(false);

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('safe address mismatch'),
        }),
      );
    });

    it.each([
      ['data', { field: 'data' as const, value: null }],
      ['safeTxGas', { field: 'safeTxGas' as const, value: null }],
      ['baseGas', { field: 'baseGas' as const, value: null }],
      ['gasPrice', { field: 'gasPrice' as const, value: null }],
      ['gasToken', { field: 'gasToken' as const, value: null }],
      ['refundReceiver', { field: 'refundReceiver' as const, value: null }],
    ])('should treat stored %s=null as equivalent to the decoded zero/empty default', async (_, override) => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = faker.helpers.arrayElement(SAFE_VERSIONS[chainId]);
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
        casing: 'lower',
      }) as Hex;
      const decoded = helper.decodeExecTransaction(
        execTransactionEncoder().encode(),
      )!;
      const stored = buildMatchingStored({
        safeAddress,
        decodedTo: decoded.to,
      })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .with(override.field as any, override.value as any)
        .build();
      mockSafeRepository.getMultiSigTransaction.mockResolvedValue(stored);

      await expect(
        helper.isSafeTxHashValid({
          version,
          chainId,
          safeAddress,
          decoded,
          safeTxHash,
        }),
      ).resolves.toBe(true);
    });
  });

  describe('decodeExecTransaction', () => {
    it('should return a SafeTransaction for valid execTransaction calldata', () => {
      const data = execTransactionEncoder().encode();
      const result = helper.decodeExecTransaction(data);
      expect(result).not.toBeNull();
      expect(result).toMatchObject({
        to: expect.any(String),
        value: expect.any(BigInt),
        data: expect.any(String),
        operation: expect.any(Number),
        safeTxGas: expect.any(BigInt),
        baseGas: expect.any(BigInt),
        gasPrice: expect.any(BigInt),
        gasToken: expect.any(String),
        refundReceiver: expect.any(String),
      });
    });

    it('should return null for non-execTransaction calldata', () => {
      expect(helper.decodeExecTransaction('0x')).toBeNull();
    });
  });

  describe('isOwnerManagementTransaction', () => {
    it.each([
      ['addOwnerWithThreshold', addOwnerWithThresholdEncoder],
      ['removeOwner', removeOwnerEncoder],
      ['swapOwner', swapOwnerEncoder],
      ['changeThreshold', changeThresholdEncoder],
    ])('should return true for %s wrapped in execTransaction', (_, encoderFn) => {
      const data = execTransactionEncoder()
        .with('data', encoderFn().encode())
        .encode();

      expect(helper.isOwnerManagementTransaction(data)).toBe(true);
    });

    it('should return false for a non-owner-management execTransaction', () => {
      const data = execTransactionEncoder()
        .with('data', erc20TransferEncoder().encode())
        .encode();

      expect(helper.isOwnerManagementTransaction(data)).toBe(false);
    });

    it('should return false for non-execTransaction calldata', () => {
      expect(helper.isOwnerManagementTransaction('0x')).toBe(false);
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
          helper.getSafeBeingRecovered({
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
          helper.getSafeBeingRecovered({
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
          helper.getSafeBeingRecovered({
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
        helper.getSafeBeingRecovered({
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
      it.each(
        MULTI_SEND_CALL_ONLY_VERSIONS[chainId],
      )('should return true for official MultiSendCallOnly at version %s', (version) => {
        const [address] = getMultiSendCallOnlyDeployments({
          version,
          chainId,
        });

        expect(
          helper.isOfficialMultiSendDeployment({
            version,
            chainId,
            address,
          }),
        ).toBe(true);
      });

      it.each(
        MULTI_SEND_VERSIONS[chainId],
      )('should return true for official MultiSend at version %s', (version) => {
        const [address] = getMultiSendDeployments({ version, chainId });

        expect(
          helper.isOfficialMultiSendDeployment({
            version,
            chainId,
            address,
          }),
        ).toBe(true);
      });
    });

    it('should return false for an unofficial address', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());

      expect(
        helper.isOfficialMultiSendDeployment({
          version: faker.system.semver(),
          chainId,
          address,
        }),
      ).toBe(false);
    });
  });

  describe('isOfficialProxyFactoryDeployment', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(
        PROXY_FACTORY_VERSIONS[chainId],
      )('should return true for official ProxyFactory at version %s', (version) => {
        const [address] = getProxyFactoryDeployments({ version, chainId });

        expect(
          helper.isOfficialProxyFactoryDeployment({
            version,
            chainId,
            address,
          }),
        ).toBe(true);
      });
    });

    it('should return false for an unofficial address', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());

      expect(
        helper.isOfficialProxyFactoryDeployment({
          version: faker.system.semver(),
          chainId,
          address,
        }),
      ).toBe(false);
    });
  });

  describe('isValidCreateProxyWithNonceCall', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(
        PROXY_FACTORY_VERSIONS[chainId],
      )('should return true for createProxyWithNonce with official L1 singleton at version %s', (version) => {
        const [singleton] = getSafeSingletonDeployments({ version, chainId });
        if (!singleton) return;
        const data = createProxyWithNonceEncoder()
          .with('singleton', singleton)
          .encode();

        expect(
          helper.isValidCreateProxyWithNonceCall({
            version,
            chainId,
            data,
          }),
        ).toBe(true);
      });

      it.each(
        PROXY_FACTORY_VERSIONS[chainId],
      )('should return true for createProxyWithNonce with official L2 singleton at version %s', (version) => {
        const [singleton] = getSafeL2SingletonDeployments({
          version,
          chainId,
        });
        if (!singleton) return;
        const data = createProxyWithNonceEncoder()
          .with('singleton', singleton)
          .encode();

        expect(
          helper.isValidCreateProxyWithNonceCall({
            version,
            chainId,
            data,
          }),
        ).toBe(true);
      });
    });

    it('should return false for an unofficial singleton address', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = PROXY_FACTORY_VERSIONS[chainId][0];
      const data = createProxyWithNonceEncoder()
        .with('singleton', getAddress(faker.finance.ethereumAddress()))
        .encode();

      expect(
        helper.isValidCreateProxyWithNonceCall({ version, chainId, data }),
      ).toBe(false);
    });

    it('should return false for non-createProxyWithNonce calldata', () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const version = PROXY_FACTORY_VERSIONS[chainId][0];

      expect(
        helper.isValidCreateProxyWithNonceCall({
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
        helper.isOfficialMastercopy({ chainId, address }),
      ).resolves.toBe(true);
    });

    it('should return false when the Safe repository rejects', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const address = getAddress(faker.finance.ethereumAddress());
      mockSafeRepository.getSafe.mockRejectedValue(
        new Error('Not official mastercopy'),
      );

      await expect(
        helper.isOfficialMastercopy({ chainId, address }),
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

      expect(helper.getSafeAddressFromMultiSend(data)).toBe(safeAddress);
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

      expect(() => helper.getSafeAddressFromMultiSend(data)).toThrow(
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

      expect(() => helper.getSafeAddressFromMultiSend(data)).toThrow(
        InvalidMultiSendError,
      );
    });
  });

  describe('getOwnersFromCreateProxyWithNonce', () => {
    describe.each(supportedChainIds)('Chain %s', (chainId) => {
      it.each(
        PROXY_FACTORY_VERSIONS[chainId],
      )('should return owners from a createProxyWithNonce call with official L1 singleton at version %s', (version) => {
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

        expect(helper.getOwnersFromCreateProxyWithNonce(data)).toEqual(owners);
      });

      it.each(
        PROXY_FACTORY_VERSIONS[chainId],
      )('should return owners from a createProxyWithNonce call with official L2 singleton at version %s', (version) => {
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

        expect(helper.getOwnersFromCreateProxyWithNonce(data)).toEqual(owners);
      });
    });

    it('should throw when data is not a createProxyWithNonce call', () => {
      expect(() => helper.getOwnersFromCreateProxyWithNonce('0x')).toThrow();
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

      expect(() => helper.getOwnersFromCreateProxyWithNonce(data)).toThrow(
        'Not a setup call',
      );
    });
  });
});
