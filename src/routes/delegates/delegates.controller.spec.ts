import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../domain.module';
import { chainBuilder } from '../../domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '../../domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '../../domain/entities/__tests__/page.builder';
import { DelegatesModule } from './delegates.module';
import { createDelegateDtoBuilder } from './entities/__tests__/create-delegate-dto.builder';
import { deleteDelegateDtoBuilder } from './entities/__tests__/delete-delegate-dto.builder';
import { deleteSafeDelegateDtoBuilder } from './entities/__tests__/delete-safe-delegate-dto.builder';

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
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder().with('safe', safe).build(),
          delegateBuilder().with('safe', safe).build(),
        ])
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: delegatesPage });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 0)
        .with('next', null)
        .with('previous', null)
        .with('results', [])
        .build();
      mockNetworkService.get.mockImplementation((url) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: delegatesPage });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should fail with bad request', async () => {
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .get(`/chains/${chain.chainId}/delegates`)
        .expect(400)
        .expect({
          message: 'At least one query param must be provided',
          statusCode: 400,
        });
    });
  });

  describe('POST delegates for a Safe', () => {
    it('Success', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.post.mockImplementation((url) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.resolve({ status: 201 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('Success with safe undefined', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      createDelegateDto.safe = undefined;
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.post.mockImplementation((url) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.resolve({ status: 201 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.post.mockImplementation((url) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.reject({
              data: { message: 'Malformed body', status: 400 },
              status: 400,
            })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.post.mockImplementation((url) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.reject({ status: 503 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('Delete delegates', () => {
    it('Success', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.reject({
              data: { message: 'Malformed body', status: 400 },
              status: 400,
            })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.reject({ status: 503 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
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
      const deleteSafeDelegateRequest = deleteSafeDelegateDtoBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/safes/${deleteSafeDelegateRequest.safe}/delegates/${deleteSafeDelegateRequest.delegate}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/safes/${deleteSafeDelegateRequest.safe}/delegates/${deleteSafeDelegateRequest.delegate}`,
        )
        .send(deleteSafeDelegateRequest)
        .expect(200);
    });

    it('Should return bad request if safe address does not match', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateRequest = deleteSafeDelegateDtoBuilder().build();
      const anotherSafeAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/safes/${anotherSafeAddress}/delegates/${body.delegate}`,
        )
        .send(deleteSafeDelegateRequest)
        .expect(400);
    });

    it('Should return bad request if delegate address does not match', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateRequest = deleteSafeDelegateDtoBuilder().build();
      const anotherDelegateAddress = faker.finance.ethereumAddress();

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/safes/${body.safe}/delegates/${anotherDelegateAddress}`,
        )
        .send(deleteSafeDelegateRequest)
        .expect(400);
    });

    it('Should return errors from provider', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateRequest = deleteSafeDelegateDtoBuilder().build();
      mockNetworkService.get.mockImplementation((url) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      mockNetworkService.delete.mockImplementation((url) =>
        url ===
        `${chain.transactionService}/api/v1/safes/${deleteSafeDelegateRequest.safe}/delegates/${deleteSafeDelegateRequest.delegate}`
          ? Promise.reject({
              data: { message: 'Malformed body', status: 400 },
              status: 400,
            })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/chains/${chain.chainId}/safes/${body.safe}/delegates/${body.delegate}`,
        )
        .send(deleteSafeDelegateRequest)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });
  });
});
