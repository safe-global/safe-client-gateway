import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import type { Server } from 'net';
import { ChainsRepository } from '@/domain/chains/chains.repository';
import { rawify } from '@/validation/entities/raw.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { createTestModule } from '@/__tests__/testing-module';

describe('Owners Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let loggingService: jest.MockedObjectDeep<ILoggingService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule();
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);
    loggingService = moduleFixture.get(LoggingService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET all safes by owner address', () => {
    it('Success for singular chain page', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });

      const chain1 = chainBuilder().with('chainId', chainId1).build();
      const chain2 = chainBuilder().with('chainId', chainId2).build();

      const safesOnChain1 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const safesOnChain2 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains`: {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [chain1, chain2])
                  .with('next', null)
                  .build(),
              ),
              status: 200,
            });
          }

          case `${safeConfigUrl}/api/v1/chains/${chainId1}`: {
            return Promise.resolve({
              data: rawify(chain1),
              status: 200,
            });
          }

          case `${safeConfigUrl}/api/v1/chains/${chainId2}`: {
            return Promise.resolve({
              data: rawify(chain2),
              status: 200,
            });
          }

          // ValidationPipe checksums ownerAddress param
          case `${chain1.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`: {
            return Promise.resolve({
              data: rawify({ safes: safesOnChain1 }),
              status: 200,
            });
          }

          case `${chain2.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`: {
            return Promise.resolve({
              data: rawify({ safes: safesOnChain2 }),
              status: 200,
            });
          }

          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          // Validation schema checksums addresses
          [chainId1]: safesOnChain1.map((safe) => getAddress(safe)),
          [chainId2]: safesOnChain2.map((safe) => getAddress(safe)),
        });
    });

    it('Success for multiple chain pages', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });

      const chain1 = chainBuilder().with('chainId', chainId1).build();
      const chain2 = chainBuilder().with('chainId', chainId2).build();

      const chainsUrl = `${safeConfigUrl}/api/v1/chains`;
      const offset = 1;
      const chainsPage1 = pageBuilder()
        .with('results', [chain1])
        .with('next', limitAndOffsetUrlFactory(undefined, offset, chainsUrl))
        .build();
      const chainsPage2 = pageBuilder()
        .with('results', [chain2])
        .with('next', null)
        .build();

      const safesOnChain1 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      const safesOnChain2 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];

      networkService.get.mockImplementation(({ url, networkRequest }) => {
        if (url === chainsUrl && !networkRequest!.params!.offset) {
          return Promise.resolve({
            data: rawify(chainsPage1),
            status: 200,
          });
        }
        if (url === chainsUrl && networkRequest!.params!.offset === offset) {
          return Promise.resolve({
            data: rawify(chainsPage2),
            status: 200,
          });
        }
        if (url === `${safeConfigUrl}/api/v1/chains/${chainId1}`) {
          return Promise.resolve({
            data: rawify(chain1),
            status: 200,
          });
        }

        if (url === `${safeConfigUrl}/api/v1/chains/${chainId2}`) {
          return Promise.resolve({
            data: rawify(chain2),
            status: 200,
          });
        }

        // ValidationPipe checksums ownerAddress param
        if (
          url ===
          `${chain1.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`
        ) {
          return Promise.resolve({
            data: rawify({ safes: safesOnChain1 }),
            status: 200,
          });
        }

        if (
          url ===
          `${chain2.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`
        ) {
          return Promise.resolve({
            data: rawify({ safes: safesOnChain2 }),
            status: 200,
          });
        }

        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          // Validation schema checksums addresses
          [chainId1]: safesOnChain1.map((safe) => getAddress(safe)),
          [chainId2]: safesOnChain2.map((safe) => getAddress(safe)),
        });
    });

    it('should gracefully handle chain-specific Transaction Service error', async () => {
      jest.spyOn(loggingService, 'warn');
      const ownerAddress = faker.finance.ethereumAddress();
      const chainId1 = faker.string.numeric();
      const chainId2 = faker.string.numeric({ exclude: [chainId1] });
      const chain1 = chainBuilder().with('chainId', chainId1).build();
      const chain2 = chainBuilder().with('chainId', chainId2).build();
      const safesOnChain1 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];
      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains`: {
            return Promise.resolve({
              data: rawify(
                pageBuilder()
                  .with('results', [chain1, chain2])
                  .with('next', null)
                  .build(),
              ),
              status: 200,
            });
          }
          case `${safeConfigUrl}/api/v1/chains/${chainId1}`: {
            return Promise.resolve({
              data: rawify(chain1),
              status: 200,
            });
          }
          case `${safeConfigUrl}/api/v1/chains/${chainId2}`: {
            return Promise.resolve({
              data: rawify(chain2),
              status: 200,
            });
          }
          // ValidationPipe checksums ownerAddress param
          case `${chain1.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`: {
            return Promise.resolve({
              data: rawify({ safes: safesOnChain1 }),
              status: 200,
            });
          }
          case `${chain2.transactionService}/api/v1/owners/${getAddress(ownerAddress)}/safes/`: {
            return Promise.reject(new Error('Test error'));
          }
          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          [chainId1]: safesOnChain1.map((safe) => getAddress(safe)),
          [chainId2]: null,
        });
      expect(loggingService.warn).toHaveBeenCalledTimes(1);
      expect(loggingService.warn).toHaveBeenNthCalledWith(
        1,
        `Failed to fetch Safe owners. chainId=${chainId2}`,
      );
    });

    it('Failure: Config API fails', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains`) {
          const error = new NetworkResponseError(
            new URL(`${safeConfigUrl}/api/v1/chains`),
            {
              status: 500,
            } as Response,
          );
          return Promise.reject(error);
        }
        return Promise.reject(`No matching rule for url: ${url}`);
      });

      await request(app.getHttpServer())
        .get(`/v2/owners/${ownerAddress}/safes`)
        .expect(500)
        .expect({
          message: 'An error occurred',
          code: 500,
        });

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(networkService.get).toHaveBeenCalledWith({
        url: `${safeConfigUrl}/api/v1/chains`,
        networkRequest: {
          params: { limit: ChainsRepository.MAX_LIMIT, offset: 0 },
        },
      });
    });

    it('Failure: data validation fails', async () => {
      const ownerAddress = faker.finance.ethereumAddress();

      const chainId = faker.string.numeric();

      const chain = chainBuilder().with('chainId', chainId).build();

      const safesOnChain = [
        faker.finance.ethereumAddress(),
        faker.number.int(),
        faker.finance.ethereumAddress(),
      ];

      networkService.get.mockImplementation(({ url }) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains`: {
            return Promise.resolve({
              data: rawify({
                results: [chain],
              }),
              status: 200,
            });
          }

          case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
            return Promise.resolve({
              data: rawify(chain),
              status: 200,
            });
          }

          case `${chain.transactionService}/api/v1/owners/${ownerAddress}/safes/`: {
            return Promise.resolve({
              data: rawify({ safes: safesOnChain }),
              status: 200,
            });
          }

          default: {
            return Promise.reject(`No matching rule for url: ${url}`);
          }
        }
      });

      await request(app.getHttpServer())
        .get(`/v2/owners/${ownerAddress}/safes`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });
  });
});
