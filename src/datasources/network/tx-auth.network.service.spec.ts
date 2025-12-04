import { TxAuthNetworkService } from '@/datasources/network/tx-auth.network.service';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { rawify } from '@/validation/entities/raw.entity';

describe('TxAuthNetworkService', () => {
  const baseNetworkService: jest.MockedObjectDeep<INetworkService> = {
    get: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
  };

  const config = {
    getOrThrow: jest.fn(),
    get: jest.fn(),
  } as jest.MockedObjectDeep<IConfigurationService>;

  const buildService = (
    options: Partial<{
      isDevelopment: boolean;
      useVpcUrl: boolean;
      apiKey: string | undefined;
    }> = {},
  ): TxAuthNetworkService => {
    const { isDevelopment = true, useVpcUrl = false } = options;
    const apiKey = 'apiKey' in options ? options.apiKey : 'tx-key';

    config.getOrThrow.mockImplementation((key: string) => {
      switch (key) {
        case 'application.isDevelopment':
          return isDevelopment;
        case 'safeTransaction.useVpcUrl':
          return useVpcUrl;
        default:
          throw new Error(`Unexpected key: ${key}`);
      }
    });
    config.get.mockImplementation((key: string) => {
      if (key === 'safeTransaction.apiKey') {
        return apiKey;
      }
      throw new Error(`Unexpected key: ${key}`);
    });

    return new TxAuthNetworkService(baseNetworkService, config);
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('adds Authorization header when in development, not using VPC, and apiKey exists', async () => {
    const service = buildService();
    const args = {
      url: 'https://example.test',
      networkRequest: { headers: { Foo: 'bar' } },
    };
    baseNetworkService.get.mockResolvedValue({
      data: rawify('ok'),
      status: 200,
    });

    await service.get(args);

    expect(baseNetworkService.get).toHaveBeenCalledWith({
      url: args.url,
      networkRequest: {
        headers: { Foo: 'bar', Authorization: 'Bearer tx-key' },
      },
    });
  });

  it('preserves params when adding Authorization header', async () => {
    const service = buildService();
    const args = {
      url: 'https://example.test',
      networkRequest: { params: { a: '1' } },
    };
    baseNetworkService.post.mockResolvedValue({
      data: rawify('ok'),
      status: 200,
    });

    await service.post(args);

    expect(baseNetworkService.post).toHaveBeenCalledWith({
      url: args.url,
      networkRequest: {
        params: { a: '1' },
        headers: { Authorization: 'Bearer tx-key' },
      },
    });
  });

  it.each([
    ['not development', { isDevelopment: false }],
    ['using VPC', { useVpcUrl: true }],
    ['missing apiKey', { apiKey: undefined }],
  ])('does not add Authorization header when %s', async (_name, overrides) => {
    const service = buildService(
      overrides as Partial<{
        isDevelopment: boolean;
        useVpcUrl: boolean;
        apiKey: string | undefined;
      }>,
    );
    const args = {
      url: 'https://example.test',
      networkRequest: { headers: { Foo: 'bar' } },
    };
    baseNetworkService.delete.mockResolvedValue({
      data: rawify('ok'),
      status: 200,
    });

    await service.delete(args);

    expect(baseNetworkService.delete).toHaveBeenCalledWith(args);
  });
});
