// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import omit from 'lodash/omit';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import { createDelegateDtoBuilder } from '#/modules/delegate/routes/entities/__tests__/create-delegate.dto.builder';
import { deleteDelegateV3DtoBuilder } from '#/modules/delegate/routes/v3/entities/__tests__/delete-delegate.v3.dto.builder';
import { updateDelegateV3DtoBuilder } from '#/modules/delegate/routes/v3/entities/__tests__/update-delegate.v3.dto.builder';
import { safeQueueDelegateBuilder } from '#/modules/safe-queue/entities/__tests__/safe-queue-delegate.builder';
import { rawify } from '#/validation/entities/raw.entity';

describe('Delegates controller (v3)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let queueBaseUri: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleFixture = await createTestModule({ config: configuration });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queueBaseUri = configurationService.getOrThrow('safeQueueService.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET delegates for a Safe (v3)', () => {
    it('should return a validation error', async () => {
      const safe = getAddress(faker.finance.ethereumAddress());
      const chain = chainBuilder().build();
      const delegatesPage = pageBuilder()
        .with('count', 2)
        .with('next', null)
        .with('previous', null)
        .with('results', [
          safeQueueDelegateBuilder()
            .with('chainId', chain.chainId)
            .with('safe', safe)
            .build(),
          {
            ...safeQueueDelegateBuilder()
              .with('chainId', chain.chainId)
              .with('safe', safe)
              .build(),
            label: true,
          },
        ])
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${queueBaseUri}/api/v1/delegates`) {
          return Promise.resolve({ data: rawify(delegatesPage), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v3/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
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
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === `${queueBaseUri}/api/v1/delegates`) {
          return Promise.resolve({ data: rawify(delegatesPage), status: 200 });
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v3/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect(delegatesPage);
    });

    it('should fail with bad request', async () => {
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .get(`/v3/chains/${chain.chainId}/delegates`)
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
    it('should get a validation error', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();

      await request(app.getHttpServer())
        .post(`/v3/chains/${faker.string.numeric()}/delegates/`)
        .send(omit(createDelegateDto, 'signature'))
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          path: ['signature'],
          message: 'Invalid input: expected string, received undefined',
        });
    });

    it('success with null safe', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      createDelegateDto.safe = null;
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.post.mockImplementation(({ url }) =>
        url === `${queueBaseUri}/api/v1/delegates`
          ? Promise.resolve({ status: 201, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v3/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(200);

      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          data: expect.objectContaining({ safe: undefined }),
        }),
      );
    });

    it('should return the upstream error message', async () => {
      const createDelegateDto = createDelegateDtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const queueUrl = `${queueBaseUri}/api/v1/delegates`;
      const error = new NetworkResponseError(
        new URL(queueUrl),
        {
          status: 400,
        } as Response,
        { message: 'Malformed body', status: 400 },
      );
      networkService.post.mockImplementation(({ url }) =>
        url === queueUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v3/chains/${chain.chainId}/delegates/`)
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
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const queueUrl = `${queueBaseUri}/api/v1/delegates`;
      const error = new NetworkResponseError(new URL(queueUrl), {
        status: 503,
      } as Response);
      networkService.post.mockImplementation(({ url }) =>
        url === queueUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v3/chains/${chain.chainId}/delegates/`)
        .send(createDelegateDto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });
  });

  describe('PATCH delegates for a Safe (v3)', () => {
    it('should get a validation error', async () => {
      const updateDelegateDto = updateDelegateV3DtoBuilder().build();

      await request(app.getHttpServer())
        .patch(`/v3/chains/${faker.string.numeric()}/delegates`)
        .send(omit(updateDelegateDto, 'signature'))
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          path: ['signature'],
          message: 'Invalid input: expected string, received undefined',
        });
    });
  });

  describe('DELETE delegates for a Safe', () => {
    it('should delete by delegate and delegator', async () => {
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder()
        .with('safe', null)
        .build();
      const chain = chainBuilder().build();
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === `${queueBaseUri}/api/v1/delegates`
          ? Promise.resolve({ data: rawify({}), status: 204 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v3/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV3Dto)
        .expect(200);

      expect(networkService.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          data: {
            delegate: delegateAddress,
            delegator: deleteDelegateV3Dto.delegator,
            safe: undefined,
            signature: deleteDelegateV3Dto.signature,
            chainId: Number(chain.chainId),
          },
        }),
      );
    });

    it('should return the upstream error message', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder().build();
      const chain = chainBuilder().build();
      const errorMessage = faker.word.words();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const queueUrl = `${queueBaseUri}/api/v1/delegates`;
      const error = new NetworkResponseError(
        new URL(queueUrl),
        {
          status: 400,
        } as Response,
        { message: errorMessage, status: 400 },
      );
      networkService.delete.mockImplementation(({ url }) =>
        url === queueUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v3/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV3Dto)
        .expect(400)
        .expect({
          message: errorMessage,
          code: 400,
        });
    });

    it('should fail with An error occurred', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder().build();
      const chain = chainBuilder().build();
      networkService.get.mockImplementation(({ url }) =>
        url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`
          ? Promise.resolve({ data: rawify(chain), status: 200 })
          : Promise.reject(`No matching rule for url: ${url}`),
      );
      const queueUrl = `${queueBaseUri}/api/v1/delegates`;
      const error = new NetworkResponseError(new URL(queueUrl), {
        status: 503,
      } as Response);
      networkService.delete.mockImplementation(({ url }) =>
        url === queueUrl
          ? Promise.reject(error)
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v3/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV3Dto)
        .expect(503)
        .expect({
          message: 'An error occurred',
          code: 503,
        });
    });

    it('should get a validation error if the signature is not valid', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder().build();
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(`/v3/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send({ ...deleteDelegateV3Dto, signature: faker.number.int() })
        .expect(422)
        .expect({
          statusCode: 422,
          code: 'invalid_type',
          expected: 'string',
          path: ['signature'],
          message: 'Invalid input: expected string, received number',
        });
    });

    it('should get a validation error if both delegator and safe are not defined', async () => {
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder().build();
      // @ts-expect-error - inferred types don't allow optional fields
      deleteDelegateV3Dto.delegator = undefined;
      // @ts-expect-error - inferred types don't allow optional fields
      deleteDelegateV3Dto.safe = undefined;
      const chain = chainBuilder().build();

      await request(app.getHttpServer())
        .delete(`/v3/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV3Dto)
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
