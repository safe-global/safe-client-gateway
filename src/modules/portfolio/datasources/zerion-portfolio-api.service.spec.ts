import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionPortfolioApi } from '@/modules/portfolio/datasources/zerion-portfolio-api.service';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import type { Portfolio } from '@/modules/portfolio/domain/entities/portfolio.entity';
import {
  zerionAttributesBuilder,
  zerionBalanceBuilder,
  zerionFungibleInfoBuilder,
  zerionImplementationBuilder,
} from '@/modules/balances/datasources/entities/__tests__/zerion-balance.entity.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const mockLoggingService = {
  debug: jest.fn(),
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockHttpErrorFactory = jest.mocked({
  from: jest.fn(),
} as jest.MockedObjectDeep<HttpErrorFactory>);

const mockChainMappingService = jest.mocked({
  getNetworkNameFromChainId: jest.fn(),
  getChainIdFromNetworkName: jest.fn(),
} as jest.MockedObjectDeep<IZerionChainMappingService>);

describe('ZerionPortfolioApiService', () => {
  let service: ZerionPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const supportedFiatCodes = Array.from(
    new Set([
      ...faker.helpers.multiple(() => faker.finance.currencyCode(), {
        count: { min: 2, max: 5 },
      }),
    ]),
  );

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.apiKey',
      zerionApiKey,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.baseUri',
      zerionBaseUri,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.currencies',
      supportedFiatCodes,
    );

    service = new ZerionPortfolioApi(
      mockNetworkService,
      fakeConfigurationService,
      mockHttpErrorFactory,
      mockLoggingService,
      mockChainMappingService,
    );
  });

  describe('getPortfolio', () => {
    it('should fail for an invalid fiatCode', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.string.alphanumeric({
        exclude: supportedFiatCodes,
      });

      await expect(
        service.getPortfolio({
          address,
          fiatCode,
        }),
      ).rejects.toThrow(`Unsupported currency code: ${fiatCode}`);
    });

    it('should include X-Env header for testnet requests', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: true,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${address}/positions`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
            'X-Env': 'testnet',
          },
          params: {
            currency: fiatCode.toLowerCase(),
            sort: 'value',
            'filter[positions]': 'no_filter',
          },
        },
      });
    });

    it('should not include X-Env header for mainnet requests', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${address}/positions`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
          },
          params: {
            currency: fiatCode.toLowerCase(),
            sort: 'value',
            'filter[positions]': 'no_filter',
          },
        },
      });
    });

    it('should use chain mapping service to get chainId from network name', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const networkName = 'ethereum';
      const chainId = '1';

      const walletPosition = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'wallet')
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', networkName)
                    .with('address', null)
                    .with('decimals', 18)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: networkName } },
        })
        .build();

      mockChainMappingService.getChainIdFromNetworkName.mockResolvedValue(
        chainId,
      );
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [walletPosition] }),
        status: 200,
      });

      const result = await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      expect(
        mockChainMappingService.getChainIdFromNetworkName,
      ).toHaveBeenCalledWith(networkName, false);
      const portfolio = result as unknown as Portfolio;
      expect(portfolio.tokenBalances).toHaveLength(1);
      expect(portfolio.tokenBalances[0].tokenInfo.chainId).toBe(chainId);
    });

    it('should skip tokens when chain mapping returns null', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const networkName = 'unknown-network';

      const walletPosition = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'wallet')
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', networkName)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: networkName } },
        })
        .build();

      mockChainMappingService.getChainIdFromNetworkName.mockResolvedValue(null);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [walletPosition] }),
        status: 200,
      });

      const result = await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      expect(
        mockChainMappingService.getChainIdFromNetworkName,
      ).toHaveBeenCalledWith(networkName, false);
      const portfolio = result as unknown as Portfolio;
      expect(portfolio.tokenBalances).toHaveLength(0);
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        `Zerion network "${networkName}" not mapped to chain ID, skipping token`,
      );
    });

    it('should use isTestnet flag when calling chain mapping service', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const networkName = 'ethereum';
      const chainId = '11155111';

      const walletPosition = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'wallet')
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', networkName)
                    .with('address', null)
                    .with('decimals', 18)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: networkName } },
        })
        .build();

      mockChainMappingService.getChainIdFromNetworkName.mockResolvedValue(
        chainId,
      );
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [walletPosition] }),
        status: 200,
      });

      await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: true,
      });

      expect(
        mockChainMappingService.getChainIdFromNetworkName,
      ).toHaveBeenCalledWith(networkName, true);
    });

    it('should skip app positions when chain mapping returns null', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const networkName = 'unknown-network';

      const depositPosition = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'deposit')
            .with('protocol', 'Aave')
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', networkName)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: networkName } },
        })
        .build();

      mockChainMappingService.getChainIdFromNetworkName.mockResolvedValue(null);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [depositPosition] }),
        status: 200,
      });

      const result = await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        `Zerion network "${networkName}" not mapped to chain ID, skipping position`,
      );
      const portfolio = result as unknown as Portfolio;
      expect(portfolio.positionBalances).toHaveLength(1);
      expect(portfolio.positionBalances[0].groups).toHaveLength(0);
    });

    it('should filter out unmapped tokens while keeping mapped ones', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const mappedNetwork = 'ethereum';
      const unmappedNetwork = 'unknown-network';

      const mappedToken = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'wallet')
            .with('value', 1000)
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('name', 'Mapped Token')
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', mappedNetwork)
                    .with('address', null)
                    .with('decimals', 18)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: mappedNetwork } },
        })
        .build();

      const unmappedToken = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'wallet')
            .with('value', 500)
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('name', 'Unmapped Token')
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', unmappedNetwork)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: unmappedNetwork } },
        })
        .build();

      mockChainMappingService.getChainIdFromNetworkName.mockImplementation(
        (network: string) => {
          if (network === mappedNetwork) return Promise.resolve('1');
          return Promise.resolve(null);
        },
      );
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [mappedToken, unmappedToken] }),
        status: 200,
      });

      const result = await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      const portfolio = result as unknown as Portfolio;
      expect(portfolio.tokenBalances).toHaveLength(1);
      expect(portfolio.tokenBalances[0].tokenInfo.name).toBe('Mapped Token');
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        `Zerion network "${unmappedNetwork}" not mapped to chain ID, skipping token`,
      );
    });

    it('should filter out unmapped app positions while keeping mapped ones', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const mappedNetwork = 'ethereum';
      const unmappedNetwork = 'unknown-network';
      const appMetadata = {
        name: 'Aave',
        icon: { url: 'https://aave.com/icon.png' },
        url: 'https://aave.com',
      };

      const mappedPosition = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'deposit')
            .with('protocol', 'Aave')
            .with('application_metadata', appMetadata)
            .with('name', 'Mapped Position')
            .with('value', 1000)
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', mappedNetwork)
                    .with('decimals', 18)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: mappedNetwork } },
        })
        .build();

      const unmappedPosition = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'deposit')
            .with('protocol', 'Aave')
            .with('application_metadata', appMetadata)
            .with('name', 'Unmapped Position')
            .with('value', 500)
            .with('flags', { displayable: true })
            .with(
              'fungible_info',
              zerionFungibleInfoBuilder()
                .with('implementations', [
                  zerionImplementationBuilder()
                    .with('chain_id', unmappedNetwork)
                    .build(),
                ])
                .build(),
            )
            .build(),
        )
        .with('relationships', {
          chain: { data: { type: 'chain', id: unmappedNetwork } },
        })
        .build();

      mockChainMappingService.getChainIdFromNetworkName.mockImplementation(
        (network: string) => {
          if (network === mappedNetwork) return Promise.resolve('1');
          return Promise.resolve(null);
        },
      );
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [mappedPosition, unmappedPosition] }),
        status: 200,
      });

      const result = await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      const portfolio = result as unknown as Portfolio;
      // Both positions belong to same app (Aave), but one is filtered out
      expect(portfolio.positionBalances).toHaveLength(1);
      expect(portfolio.positionBalances[0].appInfo.name).toBe('Aave');
      expect(portfolio.positionBalances[0].groups).toHaveLength(1);
      expect(portfolio.positionBalances[0].groups[0].items).toHaveLength(1);
      expect(portfolio.positionBalances[0].groups[0].items[0].name).toBe(
        'Mapped Position',
      );
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        `Zerion network "${unmappedNetwork}" not mapped to chain ID, skipping position`,
      );
    });

    it('should handle positions with missing relationships.chain', async () => {
      const address = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);

      const positionWithoutChain = zerionBalanceBuilder()
        .with(
          'attributes',
          zerionAttributesBuilder()
            .with('position_type', 'wallet')
            .with('flags', { displayable: true })
            .build(),
        )
        .build();
      // Remove relationships to test the edge case
      delete (positionWithoutChain as Record<string, unknown>).relationships;

      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [positionWithoutChain] }),
        status: 200,
      });

      const result = await service.getPortfolio({
        address,
        fiatCode,
        isTestnet: false,
      });

      const portfolio = result as unknown as Portfolio;
      expect(portfolio.tokenBalances).toHaveLength(0);
      expect(
        mockChainMappingService.getChainIdFromNetworkName,
      ).not.toHaveBeenCalled();
    });
  });
});
