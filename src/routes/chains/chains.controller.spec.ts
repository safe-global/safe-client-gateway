import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import { NetworkResponseError } from '../../datasources/network/entities/network.error.entity';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { Backbone } from '../../domain/backbone/entities/backbone.entity';
import { backboneBuilder } from '../../domain/backbone/entities/__tests__/backbone.builder';
import { Chain } from '../../domain/chains/entities/chain.entity';
import { MasterCopy as DomainMasterCopy } from '../../domain/chains/entities/master-copies.entity';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { masterCopyBuilder } from '../../domain/chains/entities/__tests__/master-copy.builder';
import { Page } from '../../domain/entities/page.entity';
import { PaginationData } from '../common/pagination/pagination.data';
import { ChainsModule } from './chains.module';
import { MasterCopy } from './entities/master-copy.entity';
import { TestAppProvider } from '../../app.provider';

describe('Chains Controller (Unit)', () => {
  let app: INestApplication;

  const chainsResponse: Page<Chain> = {
    count: 2,
    next: null,
    previous: null,
    results: [chainBuilder().build(), chainBuilder().build()],
  };

  const chainResponse: Chain = chainBuilder().build();
  const backboneResponse: Backbone = backboneBuilder().build();

  beforeAll(async () => {
    fakeConfigurationService.set(
      'safeConfig.baseUri',
      'https://test.safe.config',
    );

    fakeConfigurationService.set(
      'exchange.baseUri',
      'https://test.exchange.service',
    );

    fakeConfigurationService.set('exchange.apiKey', 'https://test.api.key');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        ChainsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET /chains', () => {
    it('Success', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainsResponse });

      await request(app.getHttpServer())
        .get('/v1/chains')
        .expect(200)
        .expect({
          count: chainsResponse.count,
          next: null,
          previous: null,
          results: [
            {
              chainId: chainsResponse.results[0].chainId,
              chainName: chainsResponse.results[0].chainName,
              description: chainsResponse.results[0].description,
              l2: chainsResponse.results[0].l2,
              shortName: chainsResponse.results[0].shortName,
              rpcUri: chainsResponse.results[0].rpcUri,
              safeAppsRpcUri: chainsResponse.results[0].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[0].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[0].blockExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[0].nativeCurrency,
              transactionService: chainsResponse.results[0].transactionService,
              theme: chainsResponse.results[0].theme,
              gasPrice: chainsResponse.results[0].gasPrice,
              ensRegistryAddress: chainsResponse.results[0].ensRegistryAddress,
              disabledWallets: chainsResponse.results[0].disabledWallets,
              features: chainsResponse.results[0].features,
            },
            {
              chainId: chainsResponse.results[1].chainId,
              chainName: chainsResponse.results[1].chainName,
              description: chainsResponse.results[1].description,
              l2: chainsResponse.results[1].l2,
              shortName: chainsResponse.results[1].shortName,
              rpcUri: chainsResponse.results[1].rpcUri,
              safeAppsRpcUri: chainsResponse.results[1].safeAppsRpcUri,
              publicRpcUri: chainsResponse.results[1].publicRpcUri,
              blockExplorerUriTemplate:
                chainsResponse.results[1].blockExplorerUriTemplate,
              nativeCurrency: chainsResponse.results[1].nativeCurrency,
              transactionService: chainsResponse.results[1].transactionService,
              theme: chainsResponse.results[1].theme,
              gasPrice: chainsResponse.results[1].gasPrice,
              ensRegistryAddress: chainsResponse.results[1].ensRegistryAddress,
              disabledWallets: chainsResponse.results[1].disabledWallets,
              features: chainsResponse.results[1].features,
            },
          ],
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains',
        {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      );
    });

    it('Failure: network service fails', async () => {
      mockNetworkService.get.mockRejectedValueOnce(<NetworkResponseError>{
        status: 500,
      });

      await request(app.getHttpServer()).get('/v1/chains').expect(500).expect({
        message: 'An error occurred',
        code: 500,
      });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains',
        {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      );
    });

    it('Failure: received data is not valid', async () => {
      mockNetworkService.get.mockResolvedValueOnce({
        data: {
          ...chainsResponse,
          results: [...chainsResponse.results, { invalid: 'item' }],
        },
      });

      await request(app.getHttpServer()).get('/v1/chains').expect(500).expect({
        message: 'Validation failed',
        code: 42,
        arguments: [],
      });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains',
        {
          params: {
            limit: PaginationData.DEFAULT_LIMIT,
            offset: PaginationData.DEFAULT_OFFSET,
          },
        },
      );
    });
  });

  describe('GET /:chainId', () => {
    it('Success', async () => {
      const chainId = faker.random.numeric();
      const chainDomain = chainBuilder().with('chainId', chainId).build();
      const expectedResult = {
        chainId: chainDomain.chainId,
        chainName: chainDomain.chainName,
        description: chainDomain.description,
        l2: chainDomain.l2,
        nativeCurrency: chainDomain.nativeCurrency,
        transactionService: chainDomain.transactionService,
        blockExplorerUriTemplate: chainDomain.blockExplorerUriTemplate,
        disabledWallets: chainDomain.disabledWallets,
        features: chainDomain.features,
        gasPrice: chainDomain.gasPrice,
        publicRpcUri: chainDomain.publicRpcUri,
        rpcUri: chainDomain.rpcUri,
        safeAppsRpcUri: chainDomain.safeAppsRpcUri,
        shortName: chainDomain.shortName,
        theme: chainDomain.theme,
        ensRegistryAddress: chainDomain.ensRegistryAddress,
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: chainDomain });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(200)
        .expect(expectedResult);
    });

    it('Should return not Not found', async () => {
      const chainId = faker.random.numeric();
      mockNetworkService.get.mockRejectedValueOnce({
        data: { message: 'Not Found', status: 404 },
        status: 404,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}`)
        .expect(404)
        .expect({
          message: 'Not Found',
          code: 404,
        });
    });

    it('Should fail with An error occurred', async () => {
      const chainId = faker.random.numeric();
      mockNetworkService.get.mockRejectedValueOnce({
        status: 503,
      });

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
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockResolvedValueOnce({ data: backboneResponse });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(200)
        .expect(backboneResponse);

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Failure getting the chain', async () => {
      mockNetworkService.get.mockRejectedValueOnce({
        status: 400,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains/1',
        undefined,
      );
    });

    it('Failure getting the backbone data', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 502,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/backbone')
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toBe(undefined);
    });
  });

  describe('GET /:chainId/about/master-copies', () => {
    it('Success', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const domainMasterCopiesResponse: DomainMasterCopy[] = [
        masterCopyBuilder().build(),
        masterCopyBuilder().build(),
      ];
      mockNetworkService.get.mockResolvedValueOnce({
        data: domainMasterCopiesResponse,
      });
      const masterCopiesResponse = [
        <MasterCopy>{
          address: domainMasterCopiesResponse[0].address,
          version: domainMasterCopiesResponse[0].version,
        },
        <MasterCopy>{
          address: domainMasterCopiesResponse[1].address,
          version: domainMasterCopiesResponse[1].version,
        },
      ];

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(200)
        .expect(masterCopiesResponse);

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about/master-copies/`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Failure getting the chain', async () => {
      mockNetworkService.get.mockRejectedValueOnce({
        status: 400,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(400)
        .expect({
          message: 'An error occurred',
          code: 400,
        });

      expect(mockNetworkService.get).toBeCalledTimes(1);
      expect(mockNetworkService.get).toBeCalledWith(
        'https://test.safe.config/api/v1/chains/1',
        undefined,
      );
    });

    it('Should fail getting the master-copies data', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.get.mockRejectedValueOnce({
        status: 502,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(502)
        .expect({
          message: 'An error occurred',
          code: 502,
        });

      expect(mockNetworkService.get).toBeCalledTimes(2);
      expect(mockNetworkService.get.mock.calls[0][0]).toBe(
        'https://test.safe.config/api/v1/chains/1',
      );
      expect(mockNetworkService.get.mock.calls[1][0]).toBe(
        `${chainResponse.transactionService}/api/v1/about/master-copies/`,
      );
      expect(mockNetworkService.get.mock.calls[1][1]).toBe(undefined);
    });

    it('Should return validation error', async () => {
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const domainMasterCopiesResponse = [
        { address: 1223, safe: 'error' },
        masterCopyBuilder().build(),
      ];
      mockNetworkService.get.mockResolvedValueOnce({
        data: domainMasterCopiesResponse,
      });

      await request(app.getHttpServer())
        .get('/v1/chains/1/about/master-copies')
        .expect(500)
        .expect({
          message: 'Validation failed',
          code: 42,
          arguments: [],
        });
    });
  });

  describe('GET /:chainId/about', () => {
    it('Success', async () => {
      const chainDomain = chainBuilder().build();
      const name = faker.random.words();
      const version = faker.system.semver();
      const buildNumber = faker.random.numeric();
      fakeConfigurationService.set('about.name', name);
      fakeConfigurationService.set('about.version', version);
      fakeConfigurationService.set('about.buildNumber', buildNumber);
      const expectedResult = {
        transactionServiceBaseUri: chainDomain.transactionService,
        name,
        version,
        buildNumber,
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: chainDomain });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainDomain.chainId}/about`)
        .expect(200)
        .expect(expectedResult);
    });

    it('Should return not Not found', async () => {
      const chainId = faker.random.numeric();
      mockNetworkService.get.mockRejectedValueOnce({
        data: { message: 'Not Found', status: 404 },
        status: 404,
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/about`)
        .expect(404)
        .expect({
          message: 'Not Found',
          code: 404,
        });
    });

    it('Should fail with An error occurred', async () => {
      const chainId = faker.random.numeric();
      mockNetworkService.get.mockRejectedValueOnce({
        status: 503,
      });

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
