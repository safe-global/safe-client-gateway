// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import type { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '#/datasources/cache/cache.router';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { safeQueueMultisigTransactionFrom } from '#/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import type { DeleteTransactionDto } from '#/modules/transactions/routes/entities/delete-transaction.dto.entity';
import { rawify } from '#/validation/entities/raw.entity';

describe('Delete Transaction - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let queueBaseUri: string;
  let networkService: MockedObject<INetworkService>;
  let fakeCacheService: FakeCacheService;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    queueBaseUri = configurationService.getOrThrow('safeQueueService.baseUri');
    networkService = moduleFixture.get(NetworkService);
    fakeCacheService = moduleFixture.get(CacheService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  function queueTransactionUrl(tx: MultisigTransaction): string {
    return `${queueBaseUri}/api/v1/multisig-transactions/${tx.safeTxHash}`;
  }

  /**
   * Serves the chain, the Safe and the pending transaction, which only the
   * queue service holds.
   */
  function mockPendingTransaction(args: {
    chain: Chain;
    safe: Safe;
    tx: MultisigTransaction;
  }): void {
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`) {
        return Promise.resolve({ data: rawify(args.chain), status: 200 });
      }
      if (
        url ===
        `${args.chain.transactionService}/api/v1/safes/${args.safe.address}`
      ) {
        return Promise.resolve({ data: rawify(args.safe), status: 200 });
      }
      if (url === queueTransactionUrl(args.tx)) {
        return Promise.resolve({
          data: rawify(
            safeQueueMultisigTransactionFrom(
              args.tx,
              args.chain.chainId,
            ).build(),
          ),
          status: 200,
        });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
  }

  it('should throw a validation error', async () => {
    const chainId = faker.string.numeric();
    const safeTxHash = faker.string.hexadecimal({ length: 16 });
    const invalidDeleteTransactionDto = {
      signature: faker.number.int(),
    };

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chainId}/transactions/${safeTxHash}`)
      .send(invalidDeleteTransactionDto)
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        path: ['signature'],
        message: 'Invalid input: expected string, received number',
      });
  });

  it('should delete a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const tx = multisigTransactionBuilder().with('safe', safe.address).build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    mockPendingTransaction({ chain, safe, tx });
    networkService.delete.mockImplementation(({ url }) => {
      if (url === queueTransactionUrl(tx)) {
        return Promise.resolve({ data: rawify({}), status: 204 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);

    expect(networkService.delete).toHaveBeenCalledWith(
      expect.objectContaining({
        url: queueTransactionUrl(tx),
        data: deleteTransactionDto,
      }),
    );
  });

  it('should clear the cache after deleting a multisig transaction', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const tx = multisigTransactionBuilder().with('safe', safe.address).build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };
    // Primed under a field the request never reads, so only the clear empties it.
    const queueCacheDirs = [
      new CacheDir(
        CacheRouter.getSafeQueueMultisigTransactionCacheKey({
          chainId: chain.chainId,
          safeTransactionHash: tx.safeTxHash,
        }),
        faker.string.uuid(),
      ),
      new CacheDir(
        CacheRouter.getSafeQueueMultisigTransactionsCacheKey({
          chainId: chain.chainId,
          safeAddress: tx.safe,
        }),
        faker.string.uuid(),
      ),
    ];

    mockPendingTransaction({ chain, safe, tx });
    networkService.delete.mockImplementation(({ url }) => {
      if (url === queueTransactionUrl(tx)) {
        return Promise.resolve({ data: rawify({}), status: 204 });
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });
    for (const cacheDir of queueCacheDirs) {
      await fakeCacheService.hSet(
        cacheDir,
        faker.string.alpha(),
        faker.number.int({ min: 60 }),
      );
    }

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(200);

    await expect(
      fakeCacheService.hGet(
        new CacheDir(
          `${chain.chainId}_multisig_transaction_${tx.safeTxHash}`,
          '',
        ),
      ),
    ).resolves.toBeNull();
    await expect(
      fakeCacheService.hGet(
        new CacheDir(`${chain.chainId}_multisig_transactions_${tx.safe}`, ''),
      ),
    ).resolves.toBeNull();
    for (const cacheDir of queueCacheDirs) {
      await expect(fakeCacheService.hGet(cacheDir)).resolves.toBeNull();
    }
  });

  it('should forward an error from the Safe Queue Service', async () => {
    const chain = chainBuilder().build();
    const deleteTransactionDto: DeleteTransactionDto = {
      signature: faker.string.hexadecimal({ length: 16 }),
    };

    const safe = safeBuilder().build();
    const tx = multisigTransactionBuilder().with('safe', safe.address).build();
    mockPendingTransaction({ chain, safe, tx });
    networkService.delete.mockImplementation(({ url }) => {
      if (url === queueTransactionUrl(tx)) {
        return Promise.reject(
          new NetworkResponseError(
            new URL(queueTransactionUrl(tx)),
            {
              status: 404,
            } as Response,
            { message: 'Transaction not found', status: 404 },
          ),
        );
      }
      return Promise.reject(`No matching rule for url: ${url}`);
    });

    await request(app.getHttpServer())
      .delete(`/v1/chains/${chain.chainId}/transactions/${tx.safeTxHash}`)
      .send(deleteTransactionDto)
      .expect(404)
      .expect({
        message: 'Transaction not found',
        code: 404,
      });
  });
});
