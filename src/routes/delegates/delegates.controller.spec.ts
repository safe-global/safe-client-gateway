import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import delegateFactory from '../../domain/delegate/entities/__tests__/delegate.factory';
import { DelegatesModule } from './delegates.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import chainFactory from '../../domain/chains/entities/__tests__/chain.factory';
import { Delegate } from './entities/delegate.entity';
import { Page } from '../../domain/entities/page.entity';
import { DomainModule } from '../../domain.module';
import { DataSourceErrorFilter } from '../common/filters/data-source-error.filter';
import { faker } from '@faker-js/faker';
import createDelegateDtoFactory from './entities/__tests__/create-delegate.dto.factory';
import deleteDelegateDtoFactory from './entities/__tests__/delete-delegate.dto.factory';

describe('Delegates controller', () => {
  let app: INestApplication;

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
        DelegatesModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestNetworkModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new DataSourceErrorFilter());

    await app.init();
  });

  describe('GET delegates for a Safe', () => {
    it('Success', async () => {
      const safe = faker.finance.ethereumAddress();
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const pageDelegates = <Page<Delegate>>{
        count: 2,
        results: [delegateFactory(safe), delegateFactory(safe)],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: pageDelegates });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(pageDelegates);
    });

    it('Should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const pageDelegates = <Page<Delegate>>{
        count: 0,
        results: [],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: pageDelegates });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(pageDelegates);
    });

    it('Should fail with bad request', async () => {
      const chainId = '1';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });

      await request(app.getHttpServer())
        .get(`/chains/${chainId}/delegates`)
        .expect(400)
        .expect({
          message: 'At least one query param must be provided',
          statusCode: 400,
        });
    });
  });

  describe('POST delegates for a Safe', () => {
    it('Success', async () => {
      const body = createDelegateDtoFactory();
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockResolvedValueOnce({ status: 201 });

      await request(app.getHttpServer())
        .post(`/chains/${chainId}/delegates/`)
        .send(body)
        .expect(200);
    });

    it('Success with safe undefined', async () => {
      const body = createDelegateDtoFactory();
      body.safe = undefined;
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockResolvedValueOnce({ status: 201 });

      await request(app.getHttpServer())
        .post(`/chains/${chainId}/delegates/`)
        .send(body)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const body = {
        delegate: 'wrong delegate',
        safe: 1,
      };
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockRejectedValueOnce({
        data: { message: 'Malformed body', status: 400 },
        status: 400,
      });

      await request(app.getHttpServer())
        .post(`/chains/${chainId}/delegates/`)
        .send(body)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const body = createDelegateDtoFactory();
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockRejectedValueOnce({ status: 503 });

      await request(app.getHttpServer())
        .post(`/chains/${chainId}/delegates/`)
        .send(body)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('Delete delegates', () => {
    it('Success', async () => {
      const body = deleteDelegateDtoFactory();
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.delete.mockResolvedValueOnce({
        data: {},
        status: 204,
      });

      await request(app.getHttpServer())
        .delete(`/chains/${chainId}/delegates/${body.delegate}`)
        .send(body)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const delegate = faker.finance.ethereumAddress();
      const body = {
        delegate: delegate,
        delegator: 'delegator',
        signature: 'signature',
      };
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.delete.mockRejectedValueOnce({
        data: { message: 'Malformed body', status: 400 },
        status: 400,
      });

      await request(app.getHttpServer())
        .delete(`/chains/${chainId}/delegates/${body.delegate}`)
        .send(body)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const body = deleteDelegateDtoFactory();
      const chainId = '99';
      const chainResponse = chainFactory(chainId);
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.delete.mockRejectedValueOnce({ status: 503 });

      await request(app.getHttpServer())
        .delete(`/chains/${chainId}/delegates/${body.delegate}`)
        .send(body)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });
});
