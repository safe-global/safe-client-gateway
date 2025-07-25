import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import omit from 'lodash/omit';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/domain/delegate/entities/__tests__/delegate.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { createDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/create-delegate.dto.builder';
import { deleteDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/delete-delegate.dto.builder';
import { deleteSafeDelegateDtoBuilder } from '@/routes/delegates/entities/__tests__/delete-safe-delegate.dto.builder';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { createTestModule } from '@/__tests__/testing-module';

describe('Delegates controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule({
      config: configuration,
    });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  describe('GET delegates for a Safe', () => {
    it('Success', async () => {
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
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: rawify(delegatesPage), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should return a validation error', async () => {
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
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: rawify(delegatesPage), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
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
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${chain.transactionService}/api/v1/delegates/`) {
          return Promise.resolve({ data: rawify(delegatesPage), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('Should fail with bad request', async () => {
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/delegates`)
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
    it('Success', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation(({ url }) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.resolve({ status: 201, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('should get a validation error', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();

      await request(app.getHttpServer())
        .post(`/v1/chains/${faker.string.numeric()}/delegates/`)
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

    it('Success with null safe', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      createDelegateDto.safe = null;
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation(({ url }) =>
        url === `${chain.transactionService}/api/v1/delegates/`
          ? Promise.resolve({ status: 201, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/`;
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
        .post(`/v1/chains/${chain.chainId}/delegates/`)
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
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/`;
      const error = new NetworkResponseError(new URL(transactionServiceUrl), {
        status: 503,
      } as Response);
      networkService.post.mockImplementation(({ url }) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/delegates/`)
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
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.resolve({ data: rawify({}), status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(200);
    });

    it('Should return the tx-service error message', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should fail with An error occurred', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`;
      const error = new NetworkResponseError(new URL(transactionServiceUrl), {
        status: 503,
      } as Response);
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/delegates/${deleteDelegateDto.delegate}`
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(deleteDelegateDto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });

    it('Should get a validation error if wrong signature type', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send({ ...deleteDelegateDto, signature: faker.number.int() })
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

    it('Should get a validation error if a required field is missing', async () => {
      const deleteDelegateDto = deleteDelegateDtoBuilder().build();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/delegates/${deleteDelegateDto.delegate}`,
        )
        .send(omit(deleteDelegateDto, 'delegator'))
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['delegator'],
          message: 'Required',
        });
    });
  });

  describe('Delete Safe delegates', () => {
    it('Success', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url ===
        `${chain.transactionService}/api/v1/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`
          ? Promise.resolve({ data: rawify({}), status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`,
        )
        .send(deleteSafeDelegateDto)
        .expect(200);
    });

    it('Should return errors from provider', async () => {
      const chain = chainBuilder().build();
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const transactionServiceUrl = `${chain.transactionService}/api/v1/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`;
      const error = new NetworkResponseError(
        new URL(transactionServiceUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === transactionServiceUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${chain.chainId}/safes/${deleteSafeDelegateDto.safe}/delegates/${deleteSafeDelegateDto.delegate}`,
        )
        .send(deleteSafeDelegateDto)
        .expect(400)
        .expect({
          message: 'Malformed body',
          code: 400,
        });
    });

    it('Should get a validation error', async () => {
      const deleteSafeDelegateDto = deleteSafeDelegateDtoBuilder().build();

      await request(app.getHttpServer())
        .delete(
          `/v1/chains/${faker.string.numeric()}/safes/${
            deleteSafeDelegateDto.safe
          }/delegates/${deleteSafeDelegateDto.delegate}`,
        )
        .send({ ...deleteSafeDelegateDto, safe: faker.datatype.boolean() })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          received: 'boolean',
          path: ['safe'],
          message: 'Expected string, received boolean',
        });
    });
  });
});
