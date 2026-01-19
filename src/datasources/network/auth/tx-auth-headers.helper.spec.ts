import type { IConfigurationService } from '@/config/configuration.service.interface';
import { getTxAuthHeaders } from '@/datasources/network/auth/tx-auth-headers.helper';

describe('getTxAuthHeaders', () => {
  let mockConfigService: jest.Mocked<IConfigurationService>;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigService = {
      getOrThrow: jest.fn(),
      get: jest.fn(),
    } as jest.Mocked<IConfigurationService>;
  });

  it('should return Authorization header when TX auth is enabled', () => {
    const apiKey = 'test-api-key-123';
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'application.isDevelopment') return true;
      if (key === 'safeTransaction.useVpcUrl') return false;
      throw new Error(`Unexpected key: ${key}`);
    });
    mockConfigService.get.mockReturnValue(apiKey);

    const result = getTxAuthHeaders(mockConfigService);

    expect(result).toEqual({
      Authorization: `Bearer ${apiKey}`,
    });
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'application.isDevelopment',
    );
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'safeTransaction.useVpcUrl',
    );
    expect(mockConfigService.get).toHaveBeenCalledWith(
      'safeTransaction.apiKey',
    );
  });

  it.each([
    {
      description: 'not in development mode',
      isDevelopment: false,
      useVpcUrl: false,
      apiKey: 'test-key',
    },
    {
      description: 'useVpcUrl is true',
      isDevelopment: true,
      useVpcUrl: true,
      apiKey: 'test-key',
    },
    {
      description: 'API key is undefined',
      isDevelopment: true,
      useVpcUrl: false,
      apiKey: undefined,
    },
    {
      description: 'API key is empty string',
      isDevelopment: true,
      useVpcUrl: false,
      apiKey: '',
    },
    {
      description: 'in production with VPC URL',
      isDevelopment: false,
      useVpcUrl: true,
      apiKey: 'test-key',
    },
  ])(
    'should return undefined when $description',
    ({ isDevelopment, useVpcUrl, apiKey }) => {
      mockConfigService.getOrThrow.mockImplementation((key: string) => {
        if (key === 'application.isDevelopment') return isDevelopment;
        if (key === 'safeTransaction.useVpcUrl') return useVpcUrl;
        throw new Error(`Unexpected key: ${key}`);
      });
      mockConfigService.get.mockReturnValue(apiKey);

      const result = getTxAuthHeaders(mockConfigService);

      expect(result).toBeUndefined();
    },
  );
});
