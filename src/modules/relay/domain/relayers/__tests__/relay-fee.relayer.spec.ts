// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address, Hex } from 'viem';
import { getAddress } from 'viem';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { RelayClassification } from '@/modules/relay/domain/entities/relay-classification.entity';
import { InvalidMultiSendError } from '@/modules/relay/domain/errors/invalid-multisend.error';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';
import { UnofficialMultiSendError } from '@/modules/relay/domain/errors/unofficial-multisend.error';
import { UnofficialProxyFactoryError } from '@/modules/relay/domain/errors/unofficial-proxy-factory.error';
import type { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type { RelayClassifier } from '@/modules/relay/domain/validation/relay-classifier';
import { RelayFeeRelayer } from '../relay-fee.relayer';

const mockLoggingService = jest.mocked({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockRelayApi = jest.mocked({
  relay: jest.fn(),
  getRelayCount: jest.fn(),
  setRelayCount: jest.fn(),
} as jest.MockedObjectDeep<IRelayApi>);

const mockFeeServiceApi = jest.mocked({
  canRelay: jest.fn(),
} as jest.MockedObjectDeep<IFeeServiceApi>);

const mockRelayTransactionHelper = jest.mocked({
  isSafeTxHashValid: jest.fn(),
} as jest.MockedObjectDeep<RelayTransactionHelper>);

const mockClassifier = jest.mocked({
  classify: jest.fn(),
} as jest.MockedObjectDeep<RelayClassifier>);

function fakeSafeTxHash(): Hex {
  return faker.string.hexadecimal({ length: 64, casing: 'lower' }) as Hex;
}

function fakeAddress(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

const fakeDecoded = {
  to: '0x0000000000000000000000000000000000000001' as const,
  value: BigInt(0),
  data: '0x' as const,
  operation: 0,
  safeTxGas: BigInt(0),
  baseGas: BigInt(0),
  gasPrice: BigInt(0),
  gasToken: '0x0000000000000000000000000000000000000000' as const,
  refundReceiver: '0x0000000000000000000000000000000000000000' as const,
};

describe('RelayFeeRelayer', () => {
  let target: RelayFeeRelayer;
  let fakeConfigurationService: FakeConfigurationService;
  let enabledChainId: string;

  beforeEach(() => {
    jest.resetAllMocks();

    fakeConfigurationService = new FakeConfigurationService();
    enabledChainId = faker.string.numeric();
    fakeConfigurationService.set('relay.fee', {
      enabledChainIds: [enabledChainId],
      baseUri: faker.internet.url({ appendSlash: false }),
    });

    target = new RelayFeeRelayer(
      mockLoggingService,
      fakeConfigurationService,
      mockRelayApi,
      mockFeeServiceApi,
      mockRelayTransactionHelper,
      mockClassifier,
    );
  });

  describe('canRelay', () => {
    it('should return false for chains not enabled for relay-fee', async () => {
      const result = await target.canRelay({
        chainId: faker.string.numeric({ length: 5 }),
        address: fakeAddress(),
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return false when no safeTxHash is provided', async () => {
      const result = await target.canRelay({
        chainId: enabledChainId,
        address: fakeAddress(),
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return true when FeeService approves', async () => {
      const safeTxHash = fakeSafeTxHash();
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.canRelay({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash,
      });

      expect(result).toEqual({ result: true, currentCount: 0, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
    });

    it('should return false when FeeService denies', async () => {
      const safeTxHash = fakeSafeTxHash();
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      const result = await target.canRelay({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash,
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('relay-fee canRelay denied'),
        }),
      );
    });
  });

  describe('relay', () => {
    it('should throw RelayTxDeniedError when no safeTxHash is provided for execTransaction', async () => {
      const safeAddress = fakeAddress();
      mockClassifier.classify.mockResolvedValue({
        kind: 'execTransaction',
        safeAddress,
        decoded: fakeDecoded,
      } satisfies RelayClassification);

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: safeAddress,
          data: '0x' as Hex,
          gasLimit: null,
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(
        mockRelayTransactionHelper.isSafeTxHashValid,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should relay when isSafeTxHashValid returns true and fee service approves', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();
      const taskId = faker.string.uuid();

      mockClassifier.classify.mockResolvedValue({
        kind: 'execTransaction',
        safeAddress,
        decoded: fakeDecoded,
      });
      mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(true);
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: safeAddress,
        data: '0x' as Hex,
        gasLimit: null,
        safeTxHash,
      });

      expect(result).toEqual({ taskId });
      expect(mockRelayTransactionHelper.isSafeTxHashValid).toHaveBeenCalledWith(
        {
          version: '1.3.0',
          chainId: enabledChainId,
          safeAddress,
          decoded: fakeDecoded,
          safeTxHash,
        },
      );
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
      expect(mockRelayApi.relay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        to: safeAddress,
        data: '0x',
      });
    });

    it('should throw SafeTxHashMismatchError when isSafeTxHashValid returns false', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();

      mockClassifier.classify.mockResolvedValue({
        kind: 'execTransaction',
        safeAddress,
        decoded: fakeDecoded,
      });
      mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(false);

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: safeAddress,
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(SafeTxHashMismatchError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should throw RelayTxDeniedError when fee service denies after hash validation passes', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();

      mockClassifier.classify.mockResolvedValue({
        kind: 'execTransaction',
        safeAddress,
        decoded: fakeDecoded,
      });
      mockRelayTransactionHelper.isSafeTxHashValid.mockResolvedValue(true);
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: safeAddress,
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(mockRelayApi.relay).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('fee service rejected'),
        }),
      );
    });

    it('should relay a Safe creation when classifier classifies as createProxy', async () => {
      const taskId = faker.string.uuid();

      mockClassifier.classify.mockResolvedValue({
        kind: 'createProxy',
        owners: [fakeAddress(), fakeAddress()],
      });
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: fakeAddress(),
        data: '0x' as Hex,
        gasLimit: null,
      });

      expect(result).toEqual({ taskId });
      expect(
        mockRelayTransactionHelper.isSafeTxHashValid,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should propagate UnofficialProxyFactoryError raised by the classifier', async () => {
      mockClassifier.classify.mockRejectedValueOnce(
        new UnofficialProxyFactoryError(),
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(UnofficialProxyFactoryError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it.each([
      ['recovery' as const, { kind: 'recovery', safeAddress: fakeAddress() }],
      ['multiSend' as const, { kind: 'multiSend', safeAddress: fakeAddress() }],
      [
        'createSigner' as const,
        { kind: 'createSigner', limitAddress: fakeAddress() },
      ],
    ])(
      'should throw RelayTxDeniedError for valid %s calldata (relay-fee does not sponsor it)',
      async (_, classification) => {
        mockClassifier.classify.mockResolvedValue(
          classification as RelayClassification,
        );

        await expect(
          target.relay({
            version: '1.3.0',
            chainId: enabledChainId,
            to: fakeAddress(),
            data: '0x' as Hex,
            gasLimit: null,
            safeTxHash: fakeSafeTxHash(),
          }),
        ).rejects.toThrow(RelayTxDeniedError);

        expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
        expect(mockRelayApi.relay).not.toHaveBeenCalled();
      },
    );

    it('should propagate UnofficialMultiSendError raised by the classifier (422, not 403)', async () => {
      mockClassifier.classify.mockRejectedValueOnce(
        new UnofficialMultiSendError(),
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(UnofficialMultiSendError);

      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should propagate InvalidMultiSendError raised by the classifier (varying recipients)', async () => {
      mockClassifier.classify.mockRejectedValueOnce(
        new InvalidMultiSendError(),
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(InvalidMultiSendError);

      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });
  });

  describe('getRelaysRemaining', () => {
    it('should return optimistic 1 when no safeTxHash is provided on an enabled chain', async () => {
      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return 0 for chains not enabled for relay-fee', async () => {
      const result = await target.getRelaysRemaining({
        chainId: faker.string.numeric({ length: 5 }),
        address: fakeAddress(),
        safeTxHash: fakeSafeTxHash(),
      });

      expect(result).toEqual({ remaining: 0, limit: 0 });
    });

    it('should return 1 remaining for enabled chains when FeeService approves', async () => {
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash: fakeSafeTxHash(),
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledTimes(1);
    });

    it('should pass safeTxHash to Fee Service when provided', async () => {
      const safeTxHash = fakeSafeTxHash();
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash,
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
    });

    it('should return 0 remaining for enabled chains when Fee Service denies', async () => {
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: fakeAddress(),
        safeTxHash: fakeSafeTxHash(),
      });

      expect(result).toEqual({ remaining: 0, limit: 0 });
    });
  });
});
