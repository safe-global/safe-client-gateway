import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import { getAddress } from 'viem';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '@/domain/entities/__tests__/page.builder';
import type { Server } from 'net';
import { ChainsRepository } from '@/modules/chains/domain/chains.repository';
import { rawify } from '@/validation/entities/raw.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { createTestModule } from '@/__tests__/testing-module';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';

describe('Owners Controller V3 (Unit)', () => {
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

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
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
            case `${chain1.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with(
                        'results',
                        safesOnChain1.map((address) => ({
                          address: getAddress(address),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: getAddress(faker.finance.ethereumAddress()),
                          moduleGuard: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          enabledModules: [
                            getAddress(faker.finance.ethereumAddress()),
                          ],
                        })),
                      )
                      .with('count', safesOnChain1.length)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            case `${chain2.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with(
                        'results',
                        safesOnChain2.map((address) => ({
                          address: getAddress(address),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: getAddress(faker.finance.ethereumAddress()),
                          moduleGuard: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          enabledModules: [
                            getAddress(faker.finance.ethereumAddress()),
                          ],
                        })),
                      )
                      .with('count', safesOnChain2.length)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
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

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
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
            `${chain1.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`
          ) {
            if (
              networkRequest?.params?.limit ===
                SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
              networkRequest?.params?.offset === 0
            ) {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with(
                      'results',
                      safesOnChain1.map((address) => ({
                        address: getAddress(address),
                        owners: [getAddress(faker.finance.ethereumAddress())],
                        threshold: faker.number.int({ min: 1 }),
                        nonce: faker.number.int({ min: 0 }),
                        masterCopy: getAddress(faker.finance.ethereumAddress()),
                        fallbackHandler: getAddress(
                          faker.finance.ethereumAddress(),
                        ),
                        guard: getAddress(faker.finance.ethereumAddress()),
                        moduleGuard: getAddress(
                          faker.finance.ethereumAddress(),
                        ),
                        enabledModules: [
                          getAddress(faker.finance.ethereumAddress()),
                        ],
                      })),
                    )
                    .with('count', safesOnChain1.length)
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }
            return Promise.reject(`No matching rule for url: ${url}`);
          }

          if (
            url ===
            `${chain2.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`
          ) {
            if (
              networkRequest?.params?.limit ===
                SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
              networkRequest?.params?.offset === 0
            ) {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with(
                      'results',
                      safesOnChain2.map((address) => ({
                        address: getAddress(address),
                        owners: [getAddress(faker.finance.ethereumAddress())],
                        threshold: faker.number.int({ min: 1 }),
                        nonce: faker.number.int({ min: 0 }),
                        masterCopy: getAddress(faker.finance.ethereumAddress()),
                        fallbackHandler: getAddress(
                          faker.finance.ethereumAddress(),
                        ),
                        guard: getAddress(faker.finance.ethereumAddress()),
                        moduleGuard: getAddress(
                          faker.finance.ethereumAddress(),
                        ),
                        enabledModules: [
                          getAddress(faker.finance.ethereumAddress()),
                        ],
                      })),
                    )
                    .with('count', safesOnChain2.length)
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }
            return Promise.reject(`No matching rule for url: ${url}`);
          }

          return Promise.reject(`No matching rule for url: ${url}`);
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
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
      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
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
            case `${chain1.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with(
                        'results',
                        safesOnChain1.map((address) => ({
                          address: getAddress(address),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: getAddress(faker.finance.ethereumAddress()),
                          moduleGuard: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          enabledModules: [
                            getAddress(faker.finance.ethereumAddress()),
                          ],
                        })),
                      )
                      .with('count', safesOnChain1.length)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }
            case `${chain2.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              return Promise.reject(new Error('Test error'));
            }
            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
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
        .get(`/v3/owners/${ownerAddress}/safes`)
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

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
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

            case `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with(
                        'results',
                        safesOnChain.map((address) => {
                          if (typeof address === 'string') {
                            return {
                              address: getAddress(address),
                              owners: [
                                getAddress(faker.finance.ethereumAddress()),
                              ],
                              threshold: faker.number.int({ min: 1 }),
                              nonce: faker.number.int({ min: 0 }),
                              masterCopy: getAddress(
                                faker.finance.ethereumAddress(),
                              ),
                              fallbackHandler: getAddress(
                                faker.finance.ethereumAddress(),
                              ),
                              guard: getAddress(
                                faker.finance.ethereumAddress(),
                              ),
                              moduleGuard: getAddress(
                                faker.finance.ethereumAddress(),
                              ),
                              enabledModules: [
                                getAddress(faker.finance.ethereumAddress()),
                              ],
                            };
                          }
                          // Invalid data - not a string address
                          return {
                            address: address,
                            owners: [
                              getAddress(faker.finance.ethereumAddress()),
                            ],
                            threshold: faker.number.int({ min: 1 }),
                            nonce: faker.number.int({ min: 0 }),
                            masterCopy: getAddress(
                              faker.finance.ethereumAddress(),
                            ),
                            fallbackHandler: getAddress(
                              faker.finance.ethereumAddress(),
                            ),
                            guard: getAddress(faker.finance.ethereumAddress()),
                            moduleGuard: getAddress(
                              faker.finance.ethereumAddress(),
                            ),
                            enabledModules: [
                              getAddress(faker.finance.ethereumAddress()),
                            ],
                          };
                        }),
                      )
                      .with('count', safesOnChain.length)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
        .expect(502)
        .expect({ statusCode: 502, message: 'Bad gateway' });
    });

    it('Success with empty results (no safes)', async () => {
      const ownerAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const chain = chainBuilder().with('chainId', chainId).build();

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains`: {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with('results', [chain])
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }

            case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
              return Promise.resolve({
                data: rawify(chain),
                status: 200,
              });
            }

            case `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with('results', [])
                      .with('count', 0)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          [chainId]: [],
        });
    });

    it('In case of 404 error from the tx service (no Safes found) returns empty array (not null)', async () => {
      const ownerAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const chain = chainBuilder().with('chainId', chainId).build();

      networkService.get.mockImplementation(
        ({ url }: { url: string; networkRequest?: NetworkRequest }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains`: {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with('results', [chain])
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }

            case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
              return Promise.resolve({
                data: rawify(chain),
                status: 200,
              });
            }

            case `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              // Simulate a 404 error from the transaction service
              const error = new NetworkResponseError(
                new URL(
                  `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`,
                ),
                {
                  status: 404,
                } as Response,
                { message: 'Not found' },
              );
              return Promise.reject(error);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          [chainId]: [], // Should return empty array, not null
        });
    });

    it('Success with null guard and moduleGuard', async () => {
      const ownerAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const chain = chainBuilder().with('chainId', chainId).build();

      const safeAddress = faker.finance.ethereumAddress();

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains`: {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with('results', [chain])
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }

            case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
              return Promise.resolve({
                data: rawify(chain),
                status: 200,
              });
            }

            case `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with('results', [
                        {
                          address: getAddress(safeAddress),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: null,
                          moduleGuard: null,
                          enabledModules: [],
                        },
                      ])
                      .with('count', 1)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          [chainId]: [getAddress(safeAddress)],
        });
    });

    it('Success with pagination across multiple pages', async () => {
      const ownerAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const chain = chainBuilder().with('chainId', chainId).build();

      // Create more safes than the limit to trigger pagination
      const safesPage1 = Array.from(
        { length: SAFE_TRANSACTION_SERVICE_MAX_LIMIT },
        () => faker.finance.ethereumAddress(),
      );
      const safesPage2 = [
        faker.finance.ethereumAddress(),
        faker.finance.ethereumAddress(),
      ];

      const transactionServiceUrl = `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`;
      const nextUrl = limitAndOffsetUrlFactory(
        SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        transactionServiceUrl,
      );

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains`: {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with('results', [chain])
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }

            case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
              return Promise.resolve({
                data: rawify(chain),
                status: 200,
              });
            }

            case transactionServiceUrl: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with(
                        'results',
                        safesPage1.map((address) => ({
                          address: getAddress(address),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: getAddress(faker.finance.ethereumAddress()),
                          moduleGuard: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          enabledModules: [
                            getAddress(faker.finance.ethereumAddress()),
                          ],
                        })),
                      )
                      .with('count', safesPage1.length + safesPage2.length)
                      .with('next', nextUrl)
                      .build(),
                  ),
                  status: 200,
                });
              }
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with(
                        'results',
                        safesPage2.map((address) => ({
                          address: getAddress(address),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: getAddress(faker.finance.ethereumAddress()),
                          moduleGuard: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          enabledModules: [
                            getAddress(faker.finance.ethereumAddress()),
                          ],
                        })),
                      )
                      .with('count', safesPage1.length + safesPage2.length)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          [chainId]: [...safesPage1, ...safesPage2].map((safe) =>
            getAddress(safe),
          ),
        });
    });

    it('Success with empty enabledModules array', async () => {
      const ownerAddress = faker.finance.ethereumAddress();
      const chainId = faker.string.numeric();
      const chain = chainBuilder().with('chainId', chainId).build();

      const safeAddress = faker.finance.ethereumAddress();

      networkService.get.mockImplementation(
        ({
          url,
          networkRequest,
        }: {
          url: string;
          networkRequest?: NetworkRequest;
        }) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains`: {
              return Promise.resolve({
                data: rawify(
                  pageBuilder()
                    .with('results', [chain])
                    .with('next', null)
                    .build(),
                ),
                status: 200,
              });
            }

            case `${safeConfigUrl}/api/v1/chains/${chainId}`: {
              return Promise.resolve({
                data: rawify(chain),
                status: 200,
              });
            }

            case `${chain.transactionService}/api/v2/owners/${getAddress(ownerAddress)}/safes/`: {
              if (
                networkRequest?.params?.limit ===
                  SAFE_TRANSACTION_SERVICE_MAX_LIMIT &&
                networkRequest?.params?.offset === 0
              ) {
                return Promise.resolve({
                  data: rawify(
                    pageBuilder()
                      .with('results', [
                        {
                          address: getAddress(safeAddress),
                          owners: [getAddress(faker.finance.ethereumAddress())],
                          threshold: faker.number.int({ min: 1 }),
                          nonce: faker.number.int({ min: 0 }),
                          masterCopy: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          fallbackHandler: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          guard: getAddress(faker.finance.ethereumAddress()),
                          moduleGuard: getAddress(
                            faker.finance.ethereumAddress(),
                          ),
                          enabledModules: [],
                        },
                      ])
                      .with('count', 1)
                      .with('next', null)
                      .build(),
                  ),
                  status: 200,
                });
              }
              return Promise.reject(`No matching rule for url: ${url}`);
            }

            default: {
              return Promise.reject(`No matching rule for url: ${url}`);
            }
          }
        },
      );

      await request(app.getHttpServer())
        .get(`/v3/owners/${ownerAddress}/safes`)
        .expect(200)
        .expect({
          [chainId]: [getAddress(safeAddress)],
        });
    });
  });
});
