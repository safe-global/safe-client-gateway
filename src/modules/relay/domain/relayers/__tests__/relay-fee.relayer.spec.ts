// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { RelayTransactionHelper } from '@/modules/relay/domain/relay-transaction-helper';
import type { Address, Hex } from 'viem';
import { RelayTxDeniedError } from '@/modules/relay/domain/errors/relay-tx-denied.error';
import { SafeTxHashMismatchError } from '@/modules/relay/domain/errors/safe-tx-hash-mismatch.error';

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

const mockRelayTransactionValidator = jest.mocked({
  isValidExecTransactionCall: jest.fn(),
  isSafeTxHashValid: jest.fn(),
  isValidCreateProxyWithNonceCall: jest.fn(),
  isOfficialProxyFactoryDeployment: jest.fn(),
} as jest.MockedObjectDeep<RelayTransactionHelper>);

function fakeSafeTxHash(): Hex {
  return faker.string.hexadecimal({ length: 64, casing: 'lower' }) as Hex;
}

function fakeAddress(): Address {
  return getAddress(faker.finance.ethereumAddress());
}

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
      mockRelayTransactionValidator,
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
      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        true,
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(
        mockRelayTransactionValidator.isSafeTxHashValid,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    // --- execTransaction path ---

    it('should relay when isSafeTxHashValid returns true and fee service approves', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();
      const taskId = faker.string.uuid();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isSafeTxHashValid.mockResolvedValue(true);
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
      expect(
        mockRelayTransactionValidator.isSafeTxHashValid,
      ).toHaveBeenCalledWith({
        version: '1.3.0',
        chainId: enabledChainId,
        safeAddress,
        data: '0x',
        safeTxHash,
      });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should throw SafeTxHashMismatchError when isSafeTxHashValid returns false', async () => {
      const safeTxHash = fakeSafeTxHash();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isSafeTxHashValid.mockResolvedValue(false);

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(SafeTxHashMismatchError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    // --- Safe creation path ---

    it('should relay a Safe creation when factory is official and fee service approves', async () => {
      const safeAddress = fakeAddress();
      const safeTxHash = fakeSafeTxHash();
      const taskId = faker.string.uuid();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        false,
      );
      mockRelayTransactionValidator.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isOfficialProxyFactoryDeployment.mockReturnValue(
        true,
      );
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
      expect(
        mockRelayTransactionValidator.isSafeTxHashValid,
      ).not.toHaveBeenCalled();
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
    });

    it('should relay a Safe creation without safeTxHash when factory is official', async () => {
      const taskId = faker.string.uuid();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        false,
      );
      mockRelayTransactionValidator.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isOfficialProxyFactoryDeployment.mockReturnValue(
        true,
      );
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: fakeAddress(),
        data: '0x' as Hex,
        gasLimit: null,
      });

      expect(result).toEqual({ taskId });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should throw RelayTxDeniedError for unofficial proxy factory', async () => {
      const to = fakeAddress();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        false,
      );
      mockRelayTransactionValidator.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isOfficialProxyFactoryDeployment.mockReturnValue(
        false,
      );

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to,
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash: fakeSafeTxHash(),
        }),
      ).rejects.toThrow(RelayTxDeniedError);

      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('unofficial proxy factory'),
        }),
      );
    });

    it('should throw RelayTxDeniedError when fee service denies a Safe creation with safeTxHash', async () => {
      const safeTxHash = fakeSafeTxHash();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        false,
      );
      mockRelayTransactionValidator.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isOfficialProxyFactoryDeployment.mockReturnValue(
        true,
      );
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
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

    // --- Unknown tx type ---

    it('should throw RelayTxDeniedError for unrecognised transaction type', async () => {
      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        false,
      );
      mockRelayTransactionValidator.isValidCreateProxyWithNonceCall.mockReturnValue(
        false,
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
    });

    it('should throw RelayTxDeniedError when Fee Service denies', async () => {
      const safeTxHash = fakeSafeTxHash();

      mockRelayTransactionValidator.isValidExecTransactionCall.mockReturnValue(
        false,
      );
      mockRelayTransactionValidator.isValidCreateProxyWithNonceCall.mockReturnValue(
        true,
      );
      mockRelayTransactionValidator.isOfficialProxyFactoryDeployment.mockReturnValue(
        true,
      );
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: fakeAddress(),
          data: '0x' as Hex,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(RelayTxDeniedError);

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
