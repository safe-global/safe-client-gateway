// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
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
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { SAFE_QUEUE_SERVICE_MAX_LIMIT } from '#/domain/common/constants';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { Page } from '#/domain/entities/page.entity';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { createDelegateDtoBuilder } from '#/modules/delegate/routes/entities/__tests__/create-delegate.dto.builder';
import { deleteDelegateV3DtoBuilder } from '#/modules/delegate/routes/v3/entities/__tests__/delete-delegate.v3.dto.builder';
import { updateDelegateV3DtoBuilder } from '#/modules/delegate/routes/v3/entities/__tests__/update-delegate.v3.dto.builder';
import { safeQueueDelegateBuilder } from '#/modules/safe-queue/entities/__tests__/safe-queue-delegate.builder';
import type { SafeQueueDelegate } from '#/modules/safe-queue/entities/delegate.entity';
import { PaginationData } from '#/routes/common/pagination/pagination.data';
import { rawify } from '#/validation/entities/raw.entity';

describe('Delegates controller (v3) with the Safe Queue Service', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let queueBaseUri: string;
  let networkService: MockedObject<INetworkService>;

  function queueDelegatesPage(
    delegates: Array<SafeQueueDelegate>,
  ): Page<SafeQueueDelegate> {
    return pageBuilder<SafeQueueDelegate>()
      .with('count', delegates.length)
      .with('next', null)
      .with('previous', null)
      .with('results', delegates)
      .build();
  }

  function mockGet(
    chain: Chain,
    delegatesPage: Page<SafeQueueDelegate> | null = null,
  ): void {
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${queueBaseUri}/api/v1/delegates`:
          return delegatesPage
            ? Promise.resolve({ data: rawify(delegatesPage), status: 200 })
            : Promise.reject(`No matching rule for url: ${url}`);
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();

    const queueEnabledConfig: typeof configuration = () => {
      const cfg = configuration();
      return { ...cfg, features: { ...cfg.features, safeQueueService: true } };
    };

    const moduleFixture = await createTestModule({
      config: queueEnabledConfig,
    });

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

  describe('GET delegates', () => {
    it('should map the queue delegates to the domain shape', async () => {
      const chain = chainBuilder().build();
      const safe = getAddress(faker.finance.ethereumAddress());
      const delegate = getAddress(faker.finance.ethereumAddress());
      const delegator = getAddress(faker.finance.ethereumAddress());
      const delegates = [
        safeQueueDelegateBuilder()
          .with('chainId', chain.chainId)
          .with('safe', safe)
          .build(),
        safeQueueDelegateBuilder()
          .with('chainId', chain.chainId)
          .with('safe', safe)
          .with('label', null)
          .build(),
      ];
      mockGet(chain, queueDelegatesPage(delegates));

      await request(app.getHttpServer())
        .get(
          `/v3/chains/${chain.chainId}/delegates?safe=${safe}&delegate=${delegate}&delegator=${delegator}`,
        )
        .expect(200)
        .expect({
          count: delegates.length,
          next: null,
          previous: null,
          results: delegates.map((d) => ({
            safe: d.safe,
            delegate: d.delegate,
            delegator: d.delegator,
            label: d.label ?? '',
          })),
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          networkRequest: expect.objectContaining({
            params: {
              chainId: Number(chain.chainId),
              safe,
              delegate,
              delegator,
              limit: PaginationData.DEFAULT_LIMIT,
              offset: PaginationData.DEFAULT_OFFSET,
            },
          }),
        }),
      );
      expect(networkService.get).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/delegates/`,
        }),
      );
    });

    it('should accept a delegate with a null chainId', async () => {
      const chain = chainBuilder().build();
      const safe = getAddress(faker.finance.ethereumAddress());
      const delegates = [
        safeQueueDelegateBuilder()
          .with('chainId', null)
          .with('safe', safe)
          .build(),
        safeQueueDelegateBuilder()
          .with('chainId', chain.chainId)
          .with('safe', safe)
          .build(),
      ];
      mockGet(chain, queueDelegatesPage(delegates));

      await request(app.getHttpServer())
        .get(`/v3/chains/${chain.chainId}/delegates?safe=${safe}`)
        .expect(200)
        .expect({
          count: delegates.length,
          next: null,
          previous: null,
          results: delegates.map((d) => ({
            safe: d.safe,
            delegate: d.delegate,
            delegator: d.delegator,
            label: d.label,
          })),
        });
    });

    it('should forward the label filter to the queue', async () => {
      const chain = chainBuilder().build();
      const delegator = getAddress(faker.finance.ethereumAddress());
      const label = faker.word.words();
      const delegates = [
        safeQueueDelegateBuilder()
          .with('chainId', chain.chainId)
          .with('delegator', delegator)
          .with('label', label)
          .build(),
      ];
      mockGet(chain, queueDelegatesPage(delegates));

      await request(app.getHttpServer())
        .get(`/v3/chains/${chain.chainId}/delegates`)
        .query({ delegator, label })
        .expect(200)
        .expect({
          count: delegates.length,
          next: null,
          previous: null,
          results: delegates.map((d) => ({
            safe: d.safe,
            delegate: d.delegate,
            delegator: d.delegator,
            label: d.label,
          })),
        });

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              chainId: Number(chain.chainId),
              delegator,
              label,
            }),
          }),
        }),
      );
    });

    it('should cap the limit forwarded to the queue', async () => {
      const chain = chainBuilder().build();
      const safe = getAddress(faker.finance.ethereumAddress());
      const limit = faker.number.int({
        min: SAFE_QUEUE_SERVICE_MAX_LIMIT + 1,
        max: SAFE_QUEUE_SERVICE_MAX_LIMIT * 2,
      });
      const offset = faker.number.int({ min: 1, max: 100 });
      mockGet(chain, queueDelegatesPage([]));

      await request(app.getHttpServer())
        .get(`/v3/chains/${chain.chainId}/delegates`)
        .query({ safe, cursor: `limit=${limit}&offset=${offset}` })
        .expect(200);

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              chainId: Number(chain.chainId),
              safe,
              limit: SAFE_QUEUE_SERVICE_MAX_LIMIT,
              offset,
            }),
          }),
        }),
      );
    });
  });

  describe('POST delegates', () => {
    it('should create the delegate on the queue', async () => {
      const chain = chainBuilder().build();
      const createDelegateDto = createDelegateDtoBuilder().build();
      mockGet(chain);
      networkService.post.mockImplementation(({ url }) =>
        url === `${queueBaseUri}/api/v1/delegates`
          ? Promise.resolve({ status: 201, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .post(`/v3/chains/${chain.chainId}/delegates`)
        .send(createDelegateDto)
        .expect(200);

      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          data: {
            delegate: createDelegateDto.delegate,
            delegator: createDelegateDto.delegator,
            signature: createDelegateDto.signature,
            chainId: Number(chain.chainId),
            safe: createDelegateDto.safe,
            label: createDelegateDto.label,
          },
        }),
      );
      expect(networkService.post).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/delegates/`,
        }),
      );
    });
  });

  describe('PATCH delegates', () => {
    it('should update the delegate on the queue', async () => {
      const chain = chainBuilder().build();
      const updateDelegateDto = updateDelegateV3DtoBuilder().build();
      mockGet(chain);
      networkService.patch.mockImplementation(({ url }) =>
        url === `${queueBaseUri}/api/v1/delegates`
          ? Promise.resolve({ status: 200, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .patch(`/v3/chains/${chain.chainId}/delegates`)
        .send(updateDelegateDto)
        .expect(200);

      expect(networkService.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          data: {
            delegate: updateDelegateDto.delegate,
            delegator: updateDelegateDto.delegator,
            signature: updateDelegateDto.signature,
            chainId: Number(chain.chainId),
            safe: updateDelegateDto.safe,
            label: updateDelegateDto.label,
          },
        }),
      );
      expect(networkService.patch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/delegates/${updateDelegateDto.delegate}`,
        }),
      );
    });
  });

  describe('DELETE delegates', () => {
    it('should delete the delegate on the queue', async () => {
      const chain = chainBuilder().build();
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder().build();
      mockGet(chain);
      networkService.delete.mockImplementation(({ url }) =>
        url === `${queueBaseUri}/api/v1/delegates`
          ? Promise.resolve({ status: 204, data: rawify({}) })
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
            signature: deleteDelegateV3Dto.signature,
            chainId: Number(chain.chainId),
            safe: deleteDelegateV3Dto.safe,
          },
        }),
      );
      expect(networkService.delete).not.toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${chain.transactionService}/api/v2/delegates/${delegateAddress}`,
        }),
      );
    });

    it('should resolve the delegator from the queue when only the Safe is given', async () => {
      const chain = chainBuilder().build();
      const delegateAddress = getAddress(faker.finance.ethereumAddress());
      const deleteDelegateV3Dto = deleteDelegateV3DtoBuilder()
        .with('delegator', null)
        .build();
      const queueDelegate = safeQueueDelegateBuilder()
        .with('chainId', chain.chainId)
        .with('delegate', delegateAddress)
        .with('safe', deleteDelegateV3Dto.safe)
        .build();
      mockGet(chain, queueDelegatesPage([queueDelegate]));
      networkService.delete.mockImplementation(({ url }) =>
        url === `${queueBaseUri}/api/v1/delegates`
          ? Promise.resolve({ status: 204, data: rawify({}) })
          : Promise.reject(`No matching rule for url: ${url}`),
      );

      await request(app.getHttpServer())
        .delete(`/v3/chains/${chain.chainId}/delegates/${delegateAddress}`)
        .send(deleteDelegateV3Dto)
        .expect(200);

      expect(networkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              chainId: Number(chain.chainId),
              safe: deleteDelegateV3Dto.safe,
              delegate: delegateAddress,
            }),
          }),
        }),
      );
      expect(networkService.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${queueBaseUri}/api/v1/delegates`,
          data: {
            delegate: delegateAddress,
            delegator: queueDelegate.delegator,
            signature: deleteDelegateV3Dto.signature,
            chainId: Number(chain.chainId),
            safe: deleteDelegateV3Dto.safe,
          },
        }),
      );
    });
  });
});
