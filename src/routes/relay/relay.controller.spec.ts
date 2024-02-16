import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import configuration from '@/config/entities/__tests__/configuration';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { AccountDataSourceModule } from '@/datasources/account/account.datasource.module';
import { TestAccountDataSourceModule } from '@/datasources/account/__tests__/test.account.datasource.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { INestApplication } from '@nestjs/common';
import { faker } from '@faker-js/faker';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { Hex, getAddress } from 'viem';
import {
  addOwnerWithThresholdEncoder,
  changeThresholdEncoder,
  disableModuleEncoder,
  enableModuleEncoder,
  execTransactionEncoder,
  removeOwnerEncoder,
  setFallbackHandlerEncoder,
  setGuardEncoder,
  setupEncoder,
  swapOwnerEncoder,
} from '@/domain/contracts/contracts/__tests__/safe-encoder.builder';
import { erc20TransferEncoder } from '@/domain/relay/contracts/__tests__/erc20-encoder.builder';
import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/contracts/__tests__/multi-send-encoder.builder';
import {
  getMultiSendCallOnlyDeployment,
  getMultiSendDeployment,
  getSafeL2SingletonDeployment,
  getSafeSingletonDeployment,
} from '@safe-global/safe-deployments';
import { createProxyWithNonceEncoder } from '@/domain/relay/contracts/__tests__/proxy-factory-encoder.builder';

describe('Relay controller', () => {
  let app: INestApplication;
  let configurationService: jest.MockedObjectDeep<IConfigurationService>;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let safeConfigUrl: string;
  let relayUrl: string;
  const supportedChainIds = Object.keys(configuration().relay.apiKey);

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        relay: true,
      },
      relay: {
        ...defaultConfiguration.relay,
        limit: 5,
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
      .compile();

    configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    relayUrl = configurationService.getOrThrow('relay.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /v1/chains/:chainId/relay', () => {
    describe('Relayer', () => {
      describe('execTransaction', () => {
        it('should return 201 when sending native currency to another party', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('value', faker.number.bigInt())
            .encode() as Hex;
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });

        it('should return 201 with manual gasLimit', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const gasLimit = faker.number.bigInt();
          const data = execTransactionEncoder().encode() as Hex;
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
              gasLimit: gasLimit.toString(),
            })
            .expect(201)
            .expect({
              taskId,
            });

          // The gasLimit should have a buffer added
          const expectedGasLimit = (
            BigInt(gasLimit) + BigInt(150_000)
          ).toString();
          expect(networkService.post).toHaveBeenCalledWith(
            `${relayUrl}/relays/v2/sponsored-call`,
            expect.objectContaining({
              gasLimit: expectedGasLimit,
            }),
          );
        });

        it.each([
          [
            'sending ERC-20 tokens to another party',
            erc20TransferEncoder().encode(),
          ],
          ['cancelling a transaction', '0x' as const],
          [
            'making an addOwnerWithThreshold call',
            addOwnerWithThresholdEncoder().encode(),
          ],
          ['making a changeThreshold call', changeThresholdEncoder().encode()],
          ['making an enableModule call', enableModuleEncoder().encode()],
          ['making a disableModule call', disableModuleEncoder().encode()],
          ['making a removeOwner call', removeOwnerEncoder().encode()],
          [
            'making a setFallbackHandler call',
            setFallbackHandlerEncoder().encode(),
          ],
          ['making a setGuard call', setGuardEncoder().encode()],
          ['making a swapOwner call', swapOwnerEncoder().encode()],
        ])(`should return 201 when %s`, async (_, execTransactionData) => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const data = execTransactionEncoder()
            .with('data', execTransactionData)
            .encode() as Hex;
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safe.address,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });

        it('should return 201 calling execTransaction on a nested Safe', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('to', safeAddress)
            .with('data', execTransactionEncoder().encode())
            .encode() as Hex;
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });
      });

      describe('multiSend', () => {
        it('should return 201 when entire batch is valid', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const transactions = [
            execTransactionEncoder()
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode(),
            execTransactionEncoder()
              .with('data', changeThresholdEncoder().encode())
              .encode(),
          ].map((data) => ({
            operation: faker.number.int({ min: 0, max: 1 }),
            data,
            to: safeAddress,
            value: faker.number.bigInt(),
          }));
          const data = multiSendEncoder()
            .with('transactions', multiSendTransactionsEncoder(transactions))
            .encode();
          const to = getMultiSendCallOnlyDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });

        it('should return 201 when entire batch is valid for "standard" MultiSend contracts', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const transactions = [
            execTransactionEncoder()
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode(),
            execTransactionEncoder()
              .with('data', changeThresholdEncoder().encode())
              .encode(),
          ].map((data) => ({
            operation: faker.number.int({ min: 0, max: 1 }),
            data,
            to: safeAddress,
            value: faker.number.bigInt(),
          }));
          const data = multiSendEncoder()
            .with('transactions', multiSendTransactionsEncoder(transactions))
            .encode();
          const to = getMultiSendDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });
      });

      describe('createProxyWithNonce', () => {
        it('should return 201 when creating an official L1 Safe', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';

          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const singleton = getSafeSingletonDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          const to = faker.finance.ethereumAddress();
          const data = createProxyWithNonceEncoder()
            .with('singleton', getAddress(singleton))
            .with('initializer', setupEncoder().with('owners', owners).encode())
            .encode();
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });

        it('should return 201  when creating an official L2 Safe', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const singleton = getSafeL2SingletonDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          const to = faker.finance.ethereumAddress();
          const data = createProxyWithNonceEncoder()
            .with('singleton', getAddress(singleton))
            .with('initializer', setupEncoder().with('owners', owners).encode())
            .encode();
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(201)
            .expect({
              taskId,
            });
        });
      });
    });

    describe('Transaction validation', () => {
      // TODO: Return a 422 when the transactions are invalid
      describe('execTransaction', () => {
        // execTransaction
        it('should return 500 when sending native currency to self', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with('to', safeAddress)
            .with('value', faker.number.bigInt())
            .encode() as Hex;
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            })
            .expect(500);
        });

        // transfer (execTransaction)
        it('should return 500 sending ERC-20 tokens to self', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const data = execTransactionEncoder()
            .with(
              'data',
              erc20TransferEncoder().with('to', safeAddress).encode(),
            )
            .encode() as Hex;
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            })
            .expect(500);
        });

        // Unofficial mastercopy
        it('should return 500 when the mastercopy is not official', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = execTransactionEncoder()
            .with('value', faker.number.bigInt())
            .encode() as Hex;
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Unofficial mastercopy
                return Promise.reject(new Error('Not found'));
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            })
            .expect(500);
        });
      });

      describe('multiSend', () => {
        it('should return 500 when the batch has an invalid transaction', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';
          const safe = safeBuilder().build();
          const transactions = [
            execTransactionEncoder().encode(),
            // Native ERC-20 transfer
            erc20TransferEncoder().encode(),
          ].map((data) => ({
            operation: faker.number.int({ min: 0, max: 1 }),
            data,
            to: getAddress(safe.address),
            value: faker.number.bigInt(),
          }));
          const data = multiSendEncoder()
            .with('transactions', multiSendTransactionsEncoder(transactions))
            .encode();
          const to = getMultiSendCallOnlyDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          const taskId = faker.string.uuid();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });
          networkService.post.mockImplementation((url) => {
            switch (url) {
              case `${relayUrl}/relays/v2/sponsored-call`:
                return Promise.resolve({ data: { taskId }, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(500);
        });

        it('should return 500 when the mastercopy is not official', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const transactions = [
            execTransactionEncoder()
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode(),
            execTransactionEncoder()
              .with('data', changeThresholdEncoder().encode())
              .encode(),
          ].map((data) => ({
            operation: faker.number.int({ min: 0, max: 1 }),
            data,
            to: safeAddress,
            value: faker.number.bigInt(),
          }));
          const data = multiSendEncoder()
            .with('transactions', multiSendTransactionsEncoder(transactions))
            .encode();
          const to = getMultiSendCallOnlyDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Unofficial mastercopy
                return Promise.reject(new Error('Not found'));
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(500);
        });

        it('should return 500 when the batch is to varying parties', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const version = '1.3.0';
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const otherParty = getAddress(faker.finance.ethereumAddress());
          const transactions = [
            execTransactionEncoder().with('to', safeAddress).encode(),
            execTransactionEncoder().with('to', otherParty).encode(),
          ].map((data, i) => ({
            operation: faker.number.int({ min: 0, max: 1 }),
            data,
            // Varying parties
            to: i === 0 ? safeAddress : otherParty,
            value: faker.number.bigInt(),
          }));
          const data = multiSendEncoder()
            .with('transactions', multiSendTransactionsEncoder(transactions))
            .encode();
          const to = getMultiSendCallOnlyDeployment({
            version,
            network: chainId,
          })!.networkAddresses[chainId];
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Unofficial mastercopy
                return Promise.reject(new Error('Not found'));
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(500);
        });

        it('should return 500 for unofficial MultiSend deployments', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const safe = safeBuilder().build();
          const safeAddress = getAddress(safe.address);
          const transactions = [
            execTransactionEncoder()
              .with('data', addOwnerWithThresholdEncoder().encode())
              .encode(),
            execTransactionEncoder()
              .with('data', changeThresholdEncoder().encode())
              .encode(),
          ].map((data) => ({
            operation: faker.number.int({ min: 0, max: 1 }),
            data,
            to: safeAddress,
            value: faker.number.bigInt(),
          }));
          const data = multiSendEncoder()
            .with('transactions', multiSendTransactionsEncoder(transactions))
            .encode();
          // Unofficial MultiSend deployment
          const to = faker.finance.ethereumAddress();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
                // Official mastercopy
                return Promise.resolve({ data: safe, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(500);
        });
      });

      describe('createProxyWithNonce', () => {
        it('should return 500 creating an unofficial Safe', async () => {
          const chainId = faker.helpers.arrayElement(supportedChainIds);
          const chain = chainBuilder().with('chainId', chainId).build();
          const owners = [
            getAddress(faker.finance.ethereumAddress()),
            getAddress(faker.finance.ethereumAddress()),
          ];
          const singleton = faker.finance.ethereumAddress();
          const to = faker.finance.ethereumAddress();
          const data = createProxyWithNonceEncoder()
            .with('singleton', getAddress(singleton))
            .with('initializer', setupEncoder().with('owners', owners).encode())
            .encode();
          networkService.get.mockImplementation((url) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              default:
                fail(`Unexpected URL: ${url}`);
            }
          });

          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to,
              data,
            })
            .expect(500);
        });
      });

      it('should otherwise return 500', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = erc20TransferEncoder().encode();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          })
          .expect(500);
      });
    });

    describe('Rate limiting', () => {
      it('should increment the rate limit counter of execTransaction calls', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 4,
            });
          });
      });

      it('should increment the rate limit counter of multiSend calls', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const version = '1.3.0';
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const transactions = [
          execTransactionEncoder()
            .with('data', addOwnerWithThresholdEncoder().encode())
            .encode(),
          execTransactionEncoder()
            .with('data', changeThresholdEncoder().encode())
            .encode(),
        ].map((data) => ({
          operation: faker.number.int({ min: 0, max: 1 }),
          data,
          to: safeAddress,
          value: faker.number.bigInt(),
        }));
        const data = multiSendEncoder()
          .with('transactions', multiSendTransactionsEncoder(transactions))
          .encode();
        const to = getMultiSendCallOnlyDeployment({
          version,
          network: chainId,
        })!.networkAddresses[chainId];
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to,
            data,
          });

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 4,
            });
          });
      });

      it('should increment the rate limit counter of the owners of a createProxyWithNonce call', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const version = '1.3.0';

        const owners = [
          getAddress(faker.finance.ethereumAddress()),
          getAddress(faker.finance.ethereumAddress()),
        ];
        const singleton = getSafeSingletonDeployment({
          version,
          network: chainId,
        })!.networkAddresses[chainId];
        const to = faker.finance.ethereumAddress();
        const data = createProxyWithNonceEncoder()
          .with('singleton', getAddress(singleton))
          .with('initializer', setupEncoder().with('owners', owners).encode())
          .encode();
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to,
            data,
          });

        for (const owner of owners) {
          await request(app.getHttpServer())
            .get(`/v1/chains/${chain.chainId}/relay/${owner}`)
            .expect(({ body }) => {
              expect(body).toMatchObject({
                remaining: 4,
              });
            });
        }
      });

      it('should handle both checksummed and non-checksummed addresses', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const nonChecksummedAddress = safe.address.toLowerCase();
        const checksummedSafeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${nonChecksummedAddress}`:
            case `${chain.transactionService}/api/v1/safes/${checksummedSafeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        for (const address of [nonChecksummedAddress, checksummedSafeAddress]) {
          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: address,
              data,
            });
        }

        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/relay/${nonChecksummedAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 3,
            });
          });
        await request(app.getHttpServer())
          .get(`/v1/chains/${chain.chainId}/relay/${checksummedSafeAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 3,
            });
          });
      });

      it('should not rate limit the same address on different chains', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const differentChainId = faker.string.numeric({ exclude: chainId });
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          });

        await request(app.getHttpServer())
          .get(`/v1/chains/${differentChainId}/relay/${safeAddress}`)
          .expect(({ body }) => {
            expect(body).toMatchObject({
              remaining: 5,
            });
          });
      });

      it('should return 429 if the rate limit is reached', async () => {
        const chainId = faker.helpers.arrayElement(supportedChainIds);
        const chain = chainBuilder().with('chainId', chainId).build();
        const safe = safeBuilder().build();
        const safeAddress = getAddress(safe.address);
        const data = execTransactionEncoder()
          .with('value', faker.number.bigInt())
          .encode() as Hex;
        const taskId = faker.string.uuid();
        networkService.get.mockImplementation((url) => {
          switch (url) {
            case `${safeConfigUrl}/api/v1/chains/${chainId}`:
              return Promise.resolve({ data: chain, status: 200 });
            case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
              // Official mastercopy
              return Promise.resolve({ data: safe, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });
        networkService.post.mockImplementation((url) => {
          switch (url) {
            case `${relayUrl}/relays/v2/sponsored-call`:
              return Promise.resolve({ data: { taskId }, status: 200 });
            default:
              fail(`Unexpected URL: ${url}`);
          }
        });

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _ of Array.from({ length: 5 })) {
          await request(app.getHttpServer())
            .post(`/v1/chains/${chain.chainId}/relay`)
            .send({
              to: safeAddress,
              data,
            });
        }

        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          })
          .expect(429)
          .expect({
            message: `Relay limit reached for ${safeAddress}`,
            statusCode: 429,
          });
      });
    });

    it('should return 503 if the relayer throws', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const chain = chainBuilder().with('chainId', chainId).build();
      const safe = safeBuilder().build();
      const data = execTransactionEncoder().encode() as Hex;
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safe.address}`:
            // Official mastercopy
            return Promise.resolve({ data: safe, status: 200 });
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });
      networkService.post.mockImplementation((url) => {
        switch (url) {
          case `${relayUrl}/relays/v2/sponsored-call`:
            return Promise.reject(new Error('Relayer error'));
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });

      await request(app.getHttpServer())
        .post(`/v1/chains/${chain.chainId}/relay`)
        .send({
          to: safe.address,
          data,
        })
        .expect(503);
    });
  });

  describe('GET /v1/chains/:chainId/relay/:safeAddress', () => {
    it('should return the limit and remaining relay attempts', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = faker.finance.ethereumAddress();
      await request(app.getHttpServer())
        .get(`/v1/chains/${chainId}/relay/${safeAddress}`)
        .expect(200)
        .expect({ remaining: 5, limit: 5 });
    });

    it('should not return negative limits if more requests were made than the limit', async () => {
      const chainId = faker.helpers.arrayElement(supportedChainIds);
      const chain = chainBuilder().with('chainId', chainId).build();
      const safe = safeBuilder().build();
      const safeAddress = getAddress(safe.address);
      const data = execTransactionEncoder()
        .with('value', faker.number.bigInt())
        .encode() as Hex;
      const taskId = faker.string.uuid();
      networkService.get.mockImplementation((url) => {
        switch (url) {
          case `${safeConfigUrl}/api/v1/chains/${chainId}`:
            return Promise.resolve({ data: chain, status: 200 });
          case `${chain.transactionService}/api/v1/safes/${safeAddress}`:
            // Official mastercopy
            return Promise.resolve({ data: safe, status: 200 });
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });
      networkService.post.mockImplementation((url) => {
        switch (url) {
          case `${relayUrl}/relays/v2/sponsored-call`:
            return Promise.resolve({ data: { taskId }, status: 200 });
          default:
            fail(`Unexpected URL: ${url}`);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ of Array.from({ length: 6 })) {
        await request(app.getHttpServer())
          .post(`/v1/chains/${chain.chainId}/relay`)
          .send({
            to: safeAddress,
            data,
          });
      }

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/relay/${safeAddress}`)
        .expect(200)
        .expect({
          // Not negative
          remaining: 0,
          limit: 5,
        });
    });
  });
});
