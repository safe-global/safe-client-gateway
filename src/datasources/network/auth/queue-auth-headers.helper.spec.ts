// SPDX-License-Identifier: FSL-1.1-MIT
import { get } from 'lodash';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { getQueueAuthHeaders } from '@/datasources/network/auth/queue-auth-headers.helper';

const mockConfigurationService = vi.mocked({
  getOrThrow: vi.fn(),
  get: vi.fn(),
} as MockedObject<IConfigurationService>);

function initTarget(config: typeof configuration): void {
  mockConfigurationService.getOrThrow.mockImplementation((key) => {
    return get(config(), key);
  });
  mockConfigurationService.get.mockImplementation((key) => {
    return get(config(), key);
  });
}

describe('getQueueAuthHeaders', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    initTarget(configuration);
  });

  it('should return Authorization header when Queue auth is enabled', () => {
    const apiKey = 'test-api-key-123';
    const config = configuration();
    config.application.isDevelopment = true;
    config.queueService.useVpcUrl = false;
    config.queueService.apiKey = apiKey;
    initTarget(() => config);

    const result = getQueueAuthHeaders(mockConfigurationService);

    expect(result).toEqual({
      Authorization: `Bearer ${apiKey}`,
    });
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
    const config = configuration();
    config.application.isDevelopment = isDevelopment;
    config.queueService.useVpcUrl = useVpcUrl;
    config.queueService.apiKey = apiKey;
    initTarget(() => config);

    const result = getQueueAuthHeaders(mockConfigurationService);

    expect(result).toBeUndefined();
  });
});
