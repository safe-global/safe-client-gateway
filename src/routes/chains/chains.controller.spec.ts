import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { backboneBuilder } from '@/domain/backbone/entities/__tests__/backbone.builder';
import type { Backbone } from '@/domain/backbone/entities/backbone.entity';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { singletonBuilder } from '@/domain/chains/entities/__tests__/singleton.builder';
import type { Chain } from '@/domain/chains/entities/chain.entity';
import type { Singleton } from '@/domain/chains/entities/singleton.entity';
import type { MasterCopy } from '@/routes/chains/entities/master-copy.entity';
import type { Page } from '@/domain/entities/page.entity';
import { PaginationData } from '@/routes/common/pagination/pagination.data';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { indexingStatusBuilder } from '@/domain/chains/entities/__tests__/indexing-status.builder';
import { BlockchainApiManagerModule } from '@/domain/interfaces/blockchain-api.manager.interface';
import { TestBlockchainApiManagerModule } from '@/datasources/blockchain/__tests__/test.blockchain-api.manager';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Chains Controller (Unit)', () => {
  let app: INestApplication<Server>;

  let safeConfigUrl: string;
  let name: string;
  let version: string;
  let buildNumber: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: null,
    previous: null,
    results: [chainBuilder().build(), chainBuilder().build()],
  };

  const chainResponse: Chain = chainBuilder().build();
  const backboneResponse: Backbone = backboneBuilder().build();

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule({
      modules: [
        {
          originalModule: BlockchainApiManagerModule,
          testModule: TestBlockchainApiManagerModule,
        },
      ],
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    name = configurationService.getOrThrow('about.name');
    version = configurationService.getOrThrow('about.version');
    buildNumber = configurationService.getOrThrow('about.buildNumber');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET /chains', () => {
    it('Success', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainsResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains')
        .expect(200)
        .expect({
          count: chainsResponse.count,
          next: chainsResponse.next,
          previous: chainsResponse.previous,
          results: [
            {
              chainId: chainsResponse.results[0].chainId,
              chainName: chainsResponse.results[0].chainName,
              description: chainsResponse.results[0].description,
              chainLogoUri: chainsResponse.results[0].chainLogoUri,
              l2: chainsResponse.results[0].l2,
              isTestnet: chainsResponse.results[0].isTestnet,
              zk: chainsResponse.results[0].zk,
              shortName: chainsResponse.results[0].shortName,
              rpcUri: chainsResponse.results[0].rpcUri,
              safeAppsRpcUri: chainsResponse.results[0].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[0].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[0].blockExplorerUriTemplate,
              beaconChainExplorerUriTemplate:
                chainsResponse.results[0].beaconChainExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[0].nativeCurrency,
              transactionService: chainsResponse.results[0].transactionService,
              theme: chainsResponse.results[0].theme,
              gasPrice: chainsResponse.results[0].gasPrice,
              ensRegistryAddress: getAddress(
                chainsResponse.results[0].ensRegistryAddress!,
              ),
              disabledWallets: chainsResponse.results[0].disabledWallets,
              features: chainsResponse.results[0].features,
              balancesProvider: chainsResponse.results[0].balancesProvider,
              contractAddresses: chainsResponse.results[0].contractAddresses,
              recommendedMasterCopyVersion:
                chainsResponse.results[0].recommendedMasterCopyVersion,
            },
            {
              chainId: chainsResponse.results[1].chainId,
              chainName: chainsResponse.results[1].chainName,
              description: chainsResponse.results[1].description,
              chainLogoUri: chainsResponse.results[1].chainLogoUri,
              l2: chainsResponse.results[1].l2,
              isTestnet: chainsResponse.results[1].isTestnet,
              zk: chainsResponse.results[1].zk,
              shortName: chainsResponse.results[1].shortName,
              rpcUri: chainsResponse.results[1].rpcUri,
              safeAppsRpcUri: chainsResponse.results[1].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[1].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[1].blockExplorerUriTemplate,
              beaconChainExplorerUriTemplate:
                chainsResponse.results[1].beaconChainExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[1].nativeCurrency,
              transactionService: chainsResponse.results[1].transactionService,
              theme: chainsResponse.results[1].theme,
              gasPrice: chainsResponse.results[1].gasPrice,
              ensRegistryAddress: getAddress(
                chainsResponse.results[1].ensRegistryAddress!,
              ),
              disabledWallets: chainsResponse.results[1].disabledWallets,
              features: chainsResponse.results[1].features,
              balancesProvider: chainsResponse.results[1].balancesProvider,
              contractAddresses: chainsResponse.results[1].contractAddresses,
              recommendedMasterCopyVersion:
                chainsResponse.results[1].recommendedMasterCopyVersion,
            },
          ],
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('Failure: network service fails', async () => {
      const error = new NetworkResponseError(
        new URL(`${safeConfigUrl}/v1/chains`),
        {
          status: 500,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer()).get('/v1/chains').expect(500).expect({
        message: 'An error occurred',
        code: 500,
      });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('should exclude items not passing validation', async () => {
      const invalidChains = [{ invalid: 'item' }];
      networkService.get.mockResolvedValueOnce({
        data: rawify({
          ...chainsResponse,
          results: [...chainsResponse.results, ...invalidChains],
        }),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains')
        .expect(200)
        .expect({
          count: chainsResponse.count,
          next: chainsResponse.next,
          previous: chainsResponse.previous,
          results: [
            {
              chainId: chainsResponse.results[0].chainId,
              chainName: chainsResponse.results[0].chainName,
              description: chainsResponse.results[0].description,
              chainLogoUri: chainsResponse.results[0].chainLogoUri,
              l2: chainsResponse.results[0].l2,
              isTestnet: chainsResponse.results[0].isTestnet,
              zk: chainsResponse.results[0].zk,
              shortName: chainsResponse.results[0].shortName,
              rpcUri: chainsResponse.results[0].rpcUri,
              safeAppsRpcUri: chainsResponse.results[0].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[0].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[0].blockExplorerUriTemplate,
              beaconChainExplorerUriTemplate:
                chainsResponse.results[0].beaconChainExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[0].nativeCurrency,
              transactionService: chainsResponse.results[0].transactionService,
              theme: chainsResponse.results[0].theme,
              gasPrice: chainsResponse.results[0].gasPrice,
              ensRegistryAddress: getAddress(
                chainsResponse.results[0].ensRegistryAddress!,
              ),
              disabledWallets: chainsResponse.results[0].disabledWallets,
              features: chainsResponse.results[0].features,
              balancesProvider: chainsResponse.results[0].balancesProvider,
              contractAddresses: chainsResponse.results[0].contractAddresses,
              recommendedMasterCopyVersion:
                chainsResponse.results[0].recommendedMasterCopyVersion,
            },
            {
              chainId: chainsResponse.results[1].chainId,
              chainName: chainsResponse.results[1].chainName,
              description: chainsResponse.results[1].description,
              chainLogoUri: chainsResponse.results[1].chainLogoUri,
              l2: chainsResponse.results[1].l2,
              isTestnet: chainsResponse.results[1].isTestnet,
              zk: chainsResponse.results[1].zk,
              shortName: chainsResponse.results[1].shortName,
              rpcUri: chainsResponse.results[1].rpcUri,
              safeAppsRpcUri: chainsResponse.results[1].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[1].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[1].blockExplorerUriTemplate,
              beaconChainExplorerUriTemplate:
                chainsResponse.results[1].beaconChainExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[1].nativeCurrency,
              transactionService: chainsResponse.results[1].transactionService,
              theme: chainsResponse.results[1].theme,
              gasPrice: chainsResponse.results[1].gasPrice,
              ensRegistryAddress: getAddress(
                chainsResponse.results[1].ensRegistryAddress!,
              ),
              disabledWallets: chainsResponse.results[1].disabledWallets,
              features: chainsResponse.results[1].features,
              balancesProvider: chainsResponse.results[1].balancesProvider,
              contractAddresses: chainsResponse.results[1].contractAddresses,
              recommendedMasterCopyVersion:
                chainsResponse.results[1].recommendedMasterCopyVersion,
            },
          ],
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });

    it('Failure: received data is not valid', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify({
          ...chainsResponse,
          count: chainsResponse.count?.toString(),
        }),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains')
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains`,
        networkRequest: {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      });
    });
  });

  describe('GET /:chainId', () => {
    it('Success', async () => {
      const chainId = faker.string.numeric();
      const chainDomain = chainBuilder().with('chainId', chainId).build();
      const expectedResult = {
        chainId: chainDomain.chainId,
        chainName: chainDomain.chainName,
        description: chainDomain.description,
        chainLogoUri: chainDomain.chainLogoUri,
        l2: chainDomain.l2,
        isTestnet: chainDomain.isTestnet,
        zk: chainDomain.zk,
        nativeCurrency: chainDomain.nativeCurrency,
        transactionService: chainDomain.transactionService,
        blockExplorerUriTemplate: chainDomain.blockExplorerUriTemplate,
        beaconChainExplorerUriTemplate:
          chainDomain.beaconChainExplorerUriTemplate,
        disabledWallets: chainDomain.disabledWallets,
        features: chainDomain.features,
        gasPrice: chainDomain.gasPrice,
        publicRpcUri: chainDomain.publicRpcUri,
        rpcUri: chainDomain.rpcUri,
        safeAppsRpcUri: chainDomain.safeAppsRpcUri,
        shortName: chainDomain.shortName,
        theme: chainDomain.theme,
        // Validation checksums address
        ensRegistryAddress: chainDomain.ensRegistryAddress
          ? getAddress(chainDomain.ensRegistryAddress)
          : chainDomain.ensRegistryAddress,
        balancesProvider: chainDomain.balancesProvider,
        contractAddresses: chainDomain.contractAddresses,
        recommendedMasterCopyVersion: chainDomain.recommendedMasterCopyVersion,
      };
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainDomain),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(200)
        .expect(expectedResult);
    });

    it('Should return not Not found', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 404,
        } as Response,
        { message: 'Not Found' },
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(404)
        .expect({
          message: 'Not Found',
          code: 404,
        });
    });

    it('Should fail with An error occurred', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 503,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('GET /:chainId/about/backbone', () => {
    it('Success', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: rawify(backboneResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(200)
        .expect(backboneResponse);

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });

    it('Validate the response', async () => {
      const invalidResponse = { invalid: 'value' };
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      networkService.get.mockResolvedValueOnce({
        data: rawify(invalidResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });

    it('Failure getting the chain', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 400,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/1`,
      });
    });

    it('Failure getting the backbone data', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/about`),
        {
          status: 502,
        } as Response,
      );
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });
  });

  describe('GET /:chainId/about/master-copies', () => {
    it('Success', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      const domainSingletonsResponse: Array<Singleton> = [
        singletonBuilder().build(),
        singletonBuilder().build(),
      ];
      networkService.get.mockResolvedValueOnce({
        data: rawify(domainSingletonsResponse),
        status: 200,
      });
      const masterCopiesResponse: Array<MasterCopy> = [
        {
          address: domainSingletonsResponse[0].address,
          version: domainSingletonsResponse[0].version,
        },
        {
          address: domainSingletonsResponse[1].address,
          version: domainSingletonsResponse[1].version,
        },
      ];

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(200)
        .expect(masterCopiesResponse);

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about/singletons/`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });

    it('Failure getting the chain', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/chains/1`),
        {
          status: 400,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/1`,
      });
    });

    it('Should fail getting the master-copies data', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/about/singletons/`),
        {
          status: 502,
        } as Response,
      );
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/1`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about/singletons/`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });

    it('Should return validation error', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      const domainSingletonsResponse = [
        { address: 1223, safe: 'error' },
        singletonBuilder().build(),
      ];
      networkService.get.mockResolvedValueOnce({
        data: rawify(domainSingletonsResponse),
        status: 200,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });

  describe('GET /:chainId/about/indexing', () => {
    it('Success', async () => {
      const indexingStatus = indexingStatusBuilder().build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
        }
        if (
          url === `${chainResponse.transactionService}/api/v1/about/indexing/`
        ) {
          return Promise.resolve({
            data: rawify(indexingStatus),
            status: 200,
          });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainResponse.chainId}/about/indexing`)
        .expect(200)
        .expect({
          lastSync:
            indexingStatus.erc20BlockTimestamp >
            indexingStatus.masterCopiesBlockTimestamp
              ? indexingStatus.masterCopiesBlockTimestamp.getTime()
              : indexingStatus.erc20BlockTimestamp.getTime(),
          synced: indexingStatus.synced,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about/indexing/`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });

    it('Failure getting the chain', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/chains/1`),
        {
          status: 400,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainResponse.chainId}/about/indexing`)
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`,
      });
    });

    it('Should fail getting the indexing status data', async () => {
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/api/v1/about/indexing/`),
        {
          status: 502,
        } as Response,
      );
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`) {
          return Promise.resolve({
            data: rawify(chainResponse),
            status: 200,
          });
        }
        if (
          url === `${chainResponse.transactionService}/api/v1/about/indexing/`
        ) {
          return Promise.reject(error);
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainResponse.chainId}/about/indexing`)
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(networkService.get).toHaveBeenCalledTimes(2);
      expect(networkService.get.mock.calls[0][0].url).toBe(
        `${safeConfigUrl}/api/v1/chains/${chainResponse.chainId}`,
      );
      expect(networkService.get.mock.calls[1][0].url).toBe(
        `${chainResponse.transactionService}/api/v1/about/indexing/`,
      );
      expect(networkService.get.mock.calls[1][0].networkRequest).toBe(
        undefined,
      );
    });

    it('Should return validation error', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainResponse),
        status: 200,
      });
      const indexingStatus = {
        invalid: 'indexingStatus',
      };
      networkService.get.mockResolvedValueOnce({
        data: rawify(indexingStatus),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainResponse.chainId}/about/indexing`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });

  describe('GET /:chainId/about', () => {
    it('Success', async () => {
      const chainDomain = chainBuilder().build();
      const expectedResult = {
        transactionServiceBaseUri: chainDomain.transactionService,
        name,
        version,
        buildNumber,
      };
      networkService.get.mockResolvedValueOnce({
        data: rawify(chainDomain),
        status: 200,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainDomain.chainId}/about`)
        .expect(200)
        .expect(expectedResult);
    });

    it('Should return not Not found', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 404,
        } as Response,
        { message: 'Not Found' },
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/about`)
        .expect(404)
        .expect({
          message: 'Not Found',
          code: 404,
        });
    });

    it('Should fail with An error occurred', async () => {
      const chainId = faker.string.numeric();
      const error = new NetworkResponseError(
        new URL(`${chainResponse.transactionService}/v1/chains`),
        {
          status: 503,
        } as Response,
      );
      networkService.get.mockRejectedValueOnce(error);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/about`)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });
});
