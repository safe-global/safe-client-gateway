import { BlocklistGuard } from './blocklist.guard';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';
import type { IBlocklistService } from '@/config/entities/blocklist.interface';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockBlocklistService = {
  getBlocklist: jest.fn(),
  clearCache: jest.fn(),
} as jest.MockedObjectDeep<IBlocklistService>;

describe('BlocklistGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfigurationService.getOrThrow.mockReturnValue(true);
  });

  describe('with default parameter name (safeAddress)', () => {
    it('should allow access when address is not in blocklist', () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const blockedAddress = getAddress(faker.finance.ethereumAddress());
      mockBlocklistService.getBlocklist.mockReturnValue([blockedAddress]);

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { safeAddress },
            route: { path: '/chains/1/safes/:safeAddress' },
            method: 'GET',
            ip: faker.internet.ipv4(),
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockLoggingService.warn).not.toHaveBeenCalled();
    });

    it('should block access when address is in blocklist', () => {
      const blockedAddress = getAddress(faker.finance.ethereumAddress());
      mockBlocklistService.getBlocklist.mockReturnValue([blockedAddress]);

      const route = '/chains/1/safes/:safeAddress';
      const ip = faker.internet.ipv4();
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { safeAddress: blockedAddress },
            route: { path: route },
            method: 'GET',
            ip,
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        new ForbiddenException('Access to this Safe is restricted'),
      );

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BLOCKLIST_HIT',
          address: blockedAddress,
          route,
          method: 'GET',
          clientIp: ip,
        }),
      );
    });

    it('should normalize addresses before checking blocklist', () => {
      const address = faker.finance.ethereumAddress();
      const normalizedAddress = getAddress(address);
      mockBlocklistService.getBlocklist.mockReturnValue([normalizedAddress]);

      // Test with lowercase version
      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { safeAddress: address.toLowerCase() },
            route: { path: '/chains/1/safes/:safeAddress' },
            method: 'GET',
            ip: faker.internet.ipv4(),
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        ForbiddenException,
      );
    });

    it('should allow access when route does not have safeAddress parameter', () => {
      mockBlocklistService.getBlocklist.mockReturnValue([
        getAddress(faker.finance.ethereumAddress()),
      ]);

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { chainId: '1' },
            route: { path: '/chains/:chainId' },
            method: 'GET',
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockBlocklistService.getBlocklist).not.toHaveBeenCalled();
    });

    it('should allow access when safeAddress is invalid', () => {
      mockBlocklistService.getBlocklist.mockReturnValue([
        getAddress(faker.finance.ethereumAddress()),
      ]);

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { safeAddress: 'invalid-address' },
            route: { path: '/chains/1/safes/:safeAddress' },
            method: 'GET',
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockBlocklistService.getBlocklist).not.toHaveBeenCalled();
    });

    it('should check multiple addresses in blocklist', () => {
      const blockedAddress1 = getAddress(faker.finance.ethereumAddress());
      const blockedAddress2 = getAddress(faker.finance.ethereumAddress());
      const blockedAddress3 = getAddress(faker.finance.ethereumAddress());
      const allowedAddress = getAddress(faker.finance.ethereumAddress());

      mockBlocklistService.getBlocklist.mockReturnValue([
        blockedAddress1,
        blockedAddress2,
        blockedAddress3,
      ]);

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { safeAddress: allowedAddress },
            route: { path: '/chains/1/safes/:safeAddress' },
            method: 'GET',
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });

  describe('with custom parameter name', () => {
    it('should check custom parameter name when extended', () => {
      const blockedAddress = getAddress(faker.finance.ethereumAddress());
      mockBlocklistService.getBlocklist.mockReturnValue([blockedAddress]);

      // Create a custom guard class for testing with a different parameter name
      class CustomBlocklistGuard extends BlocklistGuard {
        protected readonly parameterName: string = 'accountAddress';
      }

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: { accountAddress: blockedAddress },
            route: { path: '/accounts/:accountAddress' },
            method: 'GET',
            ip: faker.internet.ipv4(),
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new CustomBlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        ForbiddenException,
      );
    });

    it('should ignore default parameter when custom parameter is specified', () => {
      const blockedAddress = getAddress(faker.finance.ethereumAddress());
      const allowedAddress = getAddress(faker.finance.ethereumAddress());
      mockBlocklistService.getBlocklist.mockReturnValue([blockedAddress]);

      // Create a custom guard class for testing with a different parameter name
      class CustomBlocklistGuard extends BlocklistGuard {
        protected readonly parameterName: string = 'accountAddress';
      }

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: {
              safeAddress: blockedAddress, // This should be ignored
              accountAddress: allowedAddress, // This should be checked
            },
            route: { path: '/accounts/:accountAddress' },
            method: 'GET',
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new CustomBlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should allow access if getBlocklist throws an error', () => {
      mockBlocklistService.getBlocklist.mockImplementation(() => {
        throw new Error('Decryption failed');
      });

      const mockExecutionContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            params: {
              safeAddress: getAddress(faker.finance.ethereumAddress()),
            },
            route: { path: '/chains/1/safes/:safeAddress' },
            method: 'GET',
          }),
        }),
      } as jest.MockedObjectDeep<ExecutionContext>;

      const guard = new BlocklistGuard(
        mockLoggingService,
        mockConfigurationService,
        mockBlocklistService,
      );

      const result = guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
    });
  });
});
