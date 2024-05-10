import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AppModule } from '@/app.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { NetworkModule } from '@/datasources/network/network.module';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { createDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/create-delegate.dto.builder';
import { deleteDelegateV2DtoBuilder } from '@/routes/delegates/v2/entities/__tests__/delete-delegate.v2.dto.builder';
import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { omit } from 'lodash';
import { Server } from 'net';
import * as request from 'supertest';
import { getAddress } from 'viem';

describe('Delegates controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const baseConfig = configuration();

    const testConfiguration: typeof configuration = () => ({
      ...baseConfig,
      features: {
        ...baseConfig.features,
        delegatesV2: true,
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(AccountDataSourceModule)
      .useModule(TestAccountDataSourceModule)
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .compile();

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.get('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET delegates for a Safe (v2)', () => {
    it('success', async () => {
      const safe = getAddress(faker.finance.ethereumAddress());
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
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('should return a validation error', async () => {
      const safe = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder().with('safe', safe).build(),
          { ...delegateBuilder().with('safe', safe).build(), label: true },
        ])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(500)
        .expect({
          statusCode: 500,
          message: 'Internal server error',
        });
    });

    it('should return empty result', async () => {
      const safe = faker.finance.ethereumAddress();
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 0)
        .with('next', null)
        .with('previous', null)
        .with('results', [])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${chain.transactionService}/api/v2/delegates/`) {
          return Promise.resolve({ data: delegatesPage, status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('should fail with bad request', async () => {
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .get(`/v2/chains/${chain.chainId}/delegates`)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message: 'At least one property is required',
          path: [],
        });
    });
  });

  describe('POST delegates for a Safe', () => {
    it('success', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation(({ url }) =>
        url === `${chain.transactionService}/api/v2/delegates/`
          ? Promise.resolve({ status: 201, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v2/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('should get a validation error', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();

      await request(app.getHttpServer())
        .post(`/v2/chains/${faker.string.numeric()}/delegates/`)
        .send(omit(createDelegateDto, 'signature'))
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['signature'],
          message: 'Required',
        });
    });

    it('success with null safe', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      createDelegateDto.safe = null;
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation(({ url }) =>
        url === `${chain.transactionService}/api/v2/delegates/`
          ? Promise.resolve({ status: 201, data: {} })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v2/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('should return the tx-service error message', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v2/delegates/`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.post.mockImplementation(({ url }) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v2/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('should fail with An error occurred', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v2/delegates/`;
      const error = new NetworkResponseError(new URL(transactionServiceUrl), {
        status: 503,
      } as Response);
      networkService.post.mockImplementation(({ url }) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v2/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('DELETE delegates for a Safe', () => {
    it('should delete by delegate, delegator and safe', async () => {
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder().build();
      const chain = chainBuilder().build();
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v2/delegates/${delegateAddress}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV2Dto)
        .expect(200);

      expect(networkService.delete).toHaveBeenCalledWith({
        url: `${chain.transactionService}/api/v2/delegates/${delegateAddress}`,
        data: {
          delegator: deleteDelegateV2Dto.delegator,
          safe: deleteDelegateV2Dto.safe,
          signature: deleteDelegateV2Dto.signature,
        },
      });
    });

    it('should delete by delegate and delegator', async () => {
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder()
        .with('safe', null)
        .build();
      const chain = chainBuilder().build();
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v2/delegates/${delegateAddress}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV2Dto)
        .expect(200);

      expect(networkService.delete).toHaveBeenCalledWith({
        url: `${chain.transactionService}/api/v2/delegates/${delegateAddress}`,
        data: {
          delegator: deleteDelegateV2Dto.delegator,
          safe: null,
          signature: deleteDelegateV2Dto.signature,
        },
      });
    });

    it('should delete by delegate and safe', async () => {
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder()
        .with('delegator', null)
        .build();
      const chain = chainBuilder().build();
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const delegatorAddress = getAddress(faker.finance.ethereumAddress());
      const delegatesPage = pageBuilder()
        .with('count', 1)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          delegateBuilder()
            .with('delegate', delegateAddress)
            .with('delegator', delegatorAddress)
            .with('safe', deleteDelegateV2Dto.safe)
            .build(),
        ])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v2/delegates/`:
            return Promise.resolve({ data: delegatesPage, status: 200 });
          default:
            return Promise.reject(`No matching rule for url: ${url}`);
        }
      });
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v2/delegates/${delegateAddress}`
          ? Promise.resolve({ data: {}, status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV2Dto)
        .expect(200);

      expect(networkService.delete).toHaveBeenCalledWith({
        url: `${chain.transactionService}/api/v2/delegates/${delegateAddress}`,
        data: {
          delegator: delegatorAddress,
          safe: deleteDelegateV2Dto.safe,
          signature: deleteDelegateV2Dto.signature,
        },
      });
    });

    it('should return the tx-service error message', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder().build();
      const chain = chainBuilder().build();
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v2/delegates/${delegateAddress}`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: errorMessage, status: 400 },
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV2Dto)
        .expect(400)
        .expect({
          message: errorMessage,
          code: 400,
        });
    });

    it('should fail with An error occurred', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: chain, status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v2/delegates/${delegateAddress}`;
      const error = new NetworkResponseError(new URL(transactionServiceUrl), {
        status: 503,
      } as Response);
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v2/delegates/${delegateAddress}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV2Dto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });

    it('should get a validation error if the signature is not valid', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder().build();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send({ ...deleteDelegateV2Dto, signature: faker.number.int() })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['signature'],
          message: 'Expected string, received number',
        });
    });

    it('should get a validation error if both delegator and safe are not defined', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV2Dto = deleteDelegateV2DtoBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      delete deleteDelegateV2Dto.delegator;
      // @ts-expect-error - inferred types don't allow optional fields
      delete deleteDelegateV2Dto.safe;
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(`/v2/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV2Dto)
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'custom',
          message:
            "At least one of the fields 'safe' or 'delegator' is required",
          path: [],
        });
    });
  });
});
