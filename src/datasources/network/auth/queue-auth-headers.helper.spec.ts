// SPDX-License-Identifier: FSL-1.1-MIT
import type { Mocked } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { getQueueAuthHeaders } from '@/datasources/network/auth/queue-auth-headers.helper';

describe('getQueueAuthHeaders', () => {
  let mockConfigService: Mocked<IConfigurationService>;

  beforeEach(() => {
    vi.resetAllMocks();
    mockConfigService = {
      getOrThrow: vi.fn(),
      get: vi.fn(),
    } as Mocked<IConfigurationService>;
  });

  it('should return Authorization header when Queue auth is enabled', () => {
    const apiKey = 'test-api-key-123';
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'application.isDevelopment') return true;
      if (key === 'queueService.useVpcUrl') return false;
      throw new Error(`Unexpected key: ${key}`);
    });
    mockConfigService.get.mockReturnValue(apiKey);

    const result = getQueueAuthHeaders(mockConfigService);

    expect(result).toEqual({
      Authorization: `Bearer ${apiKey}`,
    });
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'application.isDevelopment',
    );
    expect(mockConfigService.getOrThrow).toHaveBeenCalledWith(
      'queueService.useVpcUrl',
    );
    expect(mockConfigService.get).toHaveBeenCalledWith('queueService.apiKey');
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
  ])('should return undefined when $description', ({
    isDevelopment,
    useVpcUrl,
    apiKey,
  }) => {
    mockConfigService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'application.isDevelopment') return isDevelopment;
      if (key === 'queueService.useVpcUrl') return useVpcUrl;
      throw new Error(`Unexpected key: ${key}`);
    });
    mockConfigService.get.mockReturnValue(apiKey);

    const result = getQueueAuthHeaders(mockConfigService);

    expect(result).toBeUndefined();
  });
});
