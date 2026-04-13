// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { RelayFeeRelayer } from '@/modules/relay/domain/relayers/relay-fee.relayer';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IRelayApi } from '@/domain/interfaces/relay-api.interface';
import type { IFeeServiceApi } from '@/domain/interfaces/fee-service-api.interface';
import type { LimitAddressesMapper } from '@/modules/relay/domain/limit-addresses.mapper';
import type { ILoggingService } from '@/logging/logging.interface';
import { RelayDeniedError } from '@/modules/relay/domain/errors/relay-denied.error';
import type { Address } from 'viem';

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

const mockLimitAddressesMapper = jest.mocked({
  getLimitAddresses: jest.fn(),
} as unknown as jest.MockedObjectDeep<LimitAddressesMapper>);

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
      mockLimitAddressesMapper,
      mockRelayApi,
      mockFeeServiceApi,
    );
  });

  describe('canRelay', () => {
    it('should return false for chains not enabled for relay-fee', async () => {
      const result = await target.canRelay({
        chainId: faker.string.numeric({ length: 5 }),
        address: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return false when no safeTxHash is provided', async () => {
      const result = await target.canRelay({
        chainId: enabledChainId,
        address: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
    });

    it('should return true when FeeService approves', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({ length: 64 });
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.canRelay({
        chainId: enabledChainId,
        address,
        safeTxHash,
      });

      expect(result).toEqual({ result: true, currentCount: 0, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
    });

    it('should return false when FeeService denies', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({ length: 64 });
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      const result = await target.canRelay({
        chainId: enabledChainId,
        address,
        safeTxHash,
      });

      expect(result).toEqual({ result: false, currentCount: 0, limit: 0 });
      expect(mockLoggingService.info).toHaveBeenCalledWith(
        expect.stringContaining('relay-fee canRelay denied'),
      );
    });
  });

  describe('relay', () => {
    it('should relay without fee check when no safeTxHash is provided', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const taskId = faker.string.uuid();
      mockLimitAddressesMapper.getLimitAddresses.mockResolvedValueOnce([
        address,
      ]);
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: address,
        data: '0x' as Address,
        gasLimit: null,
      });

      expect(result).toEqual({ taskId });
      expect(mockFeeServiceApi.canRelay).not.toHaveBeenCalled();
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should relay when FeeService approves all addresses', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({ length: 64 });
      const taskId = faker.string.uuid();
      mockLimitAddressesMapper.getLimitAddresses.mockResolvedValueOnce([
        address,
      ]);
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: address,
        data: '0x' as Address,
        gasLimit: null,
        safeTxHash,
      });

      expect(result).toEqual({ taskId });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledWith({
        chainId: enabledChainId,
        safeTxHash,
      });
      expect(mockRelayApi.relay).toHaveBeenCalled();
    });

    it('should throw RelayDeniedError when Fee Service denies', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({ length: 64 });
      mockLimitAddressesMapper.getLimitAddresses.mockResolvedValueOnce([
        address,
      ]);
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: false });

      await expect(
        target.relay({
          version: '1.3.0',
          chainId: enabledChainId,
          to: address,
          data: '0x' as Address,
          gasLimit: null,
          safeTxHash,
        }),
      ).rejects.toThrow(RelayDeniedError);

      expect(mockRelayApi.relay).not.toHaveBeenCalled();
    });

    it('should check all limit addresses', async () => {
      const address1 = getAddress(faker.finance.ethereumAddress());
      const address2 = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({ length: 64 });
      const taskId = faker.string.uuid();
      mockLimitAddressesMapper.getLimitAddresses.mockResolvedValueOnce([
        address1,
        address2,
      ]);
      mockFeeServiceApi.canRelay
        .mockResolvedValueOnce({ canRelay: true })
        .mockResolvedValueOnce({ canRelay: true });
      mockRelayApi.relay.mockResolvedValueOnce({ taskId });

      const result = await target.relay({
        version: '1.3.0',
        chainId: enabledChainId,
        to: address1,
        data: '0x' as Address,
        gasLimit: null,
        safeTxHash,
      });

      expect(result).toEqual({ taskId });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledTimes(2);
    });
  });

  describe('getRelaysRemaining', () => {
    it('should return 0 for chains not enabled for relay-fee', async () => {
      const result = await target.getRelaysRemaining({
        chainId: faker.string.numeric({ length: 5 }),
        address: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result).toEqual({ remaining: 0, limit: 0 });
    });

    it('should return 1 remaining for enabled chains when FeeService approves', async () => {
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address: getAddress(faker.finance.ethereumAddress()),
      });

      expect(result).toEqual({ remaining: 1, limit: 1 });
      expect(mockFeeServiceApi.canRelay).toHaveBeenCalledTimes(1);
    });

    it('should pass safeTxHash to Fee Service when provided', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const safeTxHash = faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`;
      mockFeeServiceApi.canRelay.mockResolvedValueOnce({ canRelay: true });

      const result = await target.getRelaysRemaining({
        chainId: enabledChainId,
        address,
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
        address: getAddress(faker.finance.ethereumAddress()),
        safeTxHash: faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
      });

      expect(result).toEqual({ remaining: 0, limit: 0 });
    });
  });
});
