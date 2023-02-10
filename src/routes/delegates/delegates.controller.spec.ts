import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
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
import { Delegate } from './entities/delegate.entity';
import { Page } from '../../domain/entities/page.entity';
import { DomainModule } from '../../domain.module';
import { faker } from '@faker-js/faker';
import createDelegateDtoFactory from './entities/__tests__/create-delegate.dto.factory';
import deleteDelegateDtoFactory from './entities/__tests__/delete-delegate.dto.factory';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '../../domain/delegate/entities/__tests__/delegate.builder';
import { TestAppProvider } from '../../app.provider';
import { DeleteSafeDelegateBuilder } from './entities/__tests__/delete-safe-delegate-request.builder';

describe('Delegates controller', () => {
  let app: INestApplication;

  const safeConfigUrl = faker.internet.url();

  beforeAll(async () => {
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set(
      'exchange.apiKey',
      faker.random.alphaNumeric(),
    );
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

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET delegates for a Safe', () => {
    it('Success', async () => {
      const safe = faker.finance.ethereumAddress();
      const chainId = '1';
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const pageDelegates = <Page<Delegate>>{
        count: 2,
        next: null,
        previous: null,
        results: [
          delegateBuilder().with('safe', safe).build(),
          delegateBuilder().with('safe', safe).build(),
        ],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: pageDelegates });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(pageDelegates);
    });

    it('Should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chainId = '1';
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      const pageDelegates = <Page<Delegate>>{
        count: 0,
        next: null,
        previous: null,
        results: [],
      };
      mockNetworkService.get.mockResolvedValueOnce({ data: pageDelegates });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(pageDelegates);
    });

    it('Should fail with bad request', async () => {
      const chainId = '1';
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/delegates`)
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
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockResolvedValueOnce({ status: 201 });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/delegates/`)
        .send(body)
        .expect(200);
    });

    it('Success with safe undefined', async () => {
      const body = createDelegateDtoFactory();
      body.safe = undefined;
      const chainId = '99';
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockResolvedValueOnce({ status: 201 });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/delegates/`)
        .send(body)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const body = {
        delegate: 'wrong delegate',
        safe: 1,
      };
      const chainId = '99';
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockRejectedValueOnce({
        data: { message: 'Malformed body', status: 400 },
        status: 400,
      });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/delegates/`)
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
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.post.mockRejectedValueOnce({ status: 503 });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chainId}/delegates/`)
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
      const chainId = faker.random.numeric();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.delete.mockResolvedValueOnce({
        data: {},
        status: 204,
      });

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/delegates/${body.delegate}`)
        .send(body)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const delegate = faker.finance.ethereumAddress();
      const chainId = faker.random.numeric();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.delete.mockRejectedValueOnce({
        data: { message: 'Malformed body', status: 400 },
        status: 400,
      });

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/delegates/${delegate}`)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const body = deleteDelegateDtoFactory();
      const chainId = faker.random.numeric();
      const chainResponse = chainBuilder().with('chainId', chainId).build();
      mockNetworkService.get.mockResolvedValueOnce({ data: chainResponse });
      mockNetworkService.delete.mockRejectedValueOnce({ status: 503 });

      await request(app.getHttpServer())
        .delete(`/v1/chains/${chainId}/delegates/${body.delegate}`)
        .send(body)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('Delete Safe delegates', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const body = DeleteSafeDelegateBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url.includes(`/api/v1/safes/${body.safe}/delegates/${body.delegate}`)
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${body.safe}/delegates/${body.delegate}`,
        )
        .send(body)
        .expect(200);
    });

    it('Should return bad request if safe address does not match', async () => {
      const chain = chainBuilder().build();
      const body = DeleteSafeDelegateBuilder().build();
      const anotherSafeAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${anotherSafeAddress}/delegates/${body.delegate}`,
        )
        .send(body)
        .expect(400);
    });

    it('Should return bad request if delegate address does not match', async () => {
      const chain = chainBuilder().build();
      const body = DeleteSafeDelegateBuilder().build();
      const anotherDelegateAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${body.safe}/delegates/${anotherDelegateAddress}`,
        )
        .send(body)
        .expect(400);
    });

    it('Should return errors from provider', async () => {
      const chain = chainBuilder().build();
      const body = DeleteSafeDelegateBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/safes/${body.safe}/delegates/${body.delegate}`
          ? Promise.reject({
              data: { message: 'Malformed body', status: 400 },
              status: 400,
            })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${body.safe}/delegates/${body.delegate}`,
        )
        .send(body)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });
  });
});
