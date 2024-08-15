import { INestApplication, NotFoundException } from '@nestjs/common';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '@/app.module';
import { CacheModule } from '@/datasources/cache/cache.module';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import request from 'supertest';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { setPreSignatureEncoder } from '@/domain/swaps/contracts/__tests__/encoders/gp-v2-encoder.builder';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { faker } from '@faker-js/faker';
import { Server } from 'net';
import { encodeFunctionData, erc4626Abi, getAddress, parseAbi } from 'viem';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { dedicatedStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import { pooledStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/pooled-staking-stats.entity.builder';
import { TestBlockchainApiManagerModule } from '@/datasources/blockchain/__tests__/test.blockchain-api.manager';
import {
  BlockchainApiManagerModule,
  IBlockchainApiManager,
} from '@/domain/interfaces/blockchain-api.manager.interface';
import { FakeBlockchainApiManager } from '@/datasources/blockchain/__tests__/fake.blockchain-api.manager';
import { defiVaultStatsBuilder } from '@/datasources/staking-api/entities/__tests__/defi-vault-stats.entity.builder';

const readContractMock = jest.fn();

describe('TransactionsViewController tests', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let swapsApiUrl: string;
  let stakingApiUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let blockchainApiManager: FakeBlockchainApiManager;

  const swapsVerifiedApp = faker.company.buzzNoun();
  const swapsChainId = '1';

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfig = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfig,
      features: {
        ...baseConfig.features,
        confirmationView: true,
      },
      swaps: {
        ...baseConfig.swaps,
        restrictApps: true,
        allowedApps: [swapsVerifiedApp],
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule.register(testConfiguration)],
    })
      .overrideModule(CacheModule)
      .useModule(TestCacheModule)
      .overrideModule(RequestScopedLoggingModule)
      .useModule(TestLoggingModule)
      .overrideModule(NetworkModule)
      .useModule(TestNetworkModule)
      .overrideModule(QueuesApiModule)
      .useModule(TestQueuesApiModule)
      .overrideModule(BlockchainApiManagerModule)
      .useModule(TestBlockchainApiManagerModule)
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    swapsApiUrl = configurationService.getOrThrow(`swaps.api.${swapsChainId}`);
    stakingApiUrl = configurationService.getOrThrow('staking.mainnet.baseUri');
    networkService = moduleFixture.get(NetworkService);
    blockchainApiManager = moduleFixture.get(IBlockchainApiManager);
    blockchainApiManager.getApi.mockImplementation(() => ({
      readContract: readContractMock,
    }));

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Gets Generic confirmation view', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const dataDecoded = dataDecodedBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: chain, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
        return Promise.resolve({ data: dataDecoded, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .post(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
      )
      .send({
        data: '0x',
      })
      .expect(200)
      .expect({
        type: 'GENERIC',
        method: dataDecoded.method,
        parameters: dataDecoded.parameters,
      });
  });

  describe('Staking', () => {
    describe('Dedicated staking', () => {
      describe('deposit', () => {
        it('returns the dedicated staking `deposit` confirmation view', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('status', 'active')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const networkStats = networkStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: { data: dedicatedStakingStats },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: { data: networkStats },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_DEDICATED_STAKE',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              estimatedEntryTime: networkStats.estimated_entry_time_seconds,
              estimatedExitTime: networkStats.estimated_exit_time_seconds,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds,
              fee: +deployment.product_fee!,
              monthlyNrr:
                dedicatedStakingStats.gross_apy.last_30d *
                (1 - +deployment.product_fee!),
              annualNrr:
                dedicatedStakingStats.gross_apy.last_30d *
                (1 - +deployment.product_fee!),
            });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('status', 'active')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not dedicated-specific', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling') // Pooling
            .with('status', 'active')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'dedicated')
            .with('status', 'active')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not active', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('status', 'unknown') // Not active
            .with('product_fee', faker.number.float().toString())
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment has no product fee', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('status', 'active')
            .with('product_fee', null) // No product fee
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the dedicated staking stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('status', 'active')
            .with('product_fee', faker.number.float().toString())
            .build();
          const networkStats = networkStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.reject(new NotFoundException());
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: { data: networkStats },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the network stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('status', 'active')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/kiln-stats`) {
              return Promise.resolve({
                data: { data: dedicatedStakingStats },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });
      });
    });

    describe('Pooled staking', () => {
      describe('stake', () => {
        it('returns the pooled staking `stake` confirmation view', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling')
            .with('status', 'active')
            .build();
          const pooledStakingStats = pooledStakingStatsBuilder()
            .with('address', deployment.address)
            .build();
          const networkStats = networkStatsBuilder().build();
          const poolToken = tokenBuilder()
            .with('address', deployment.address)
            .with('decimals', null) // Test default decimals
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/onchain/v2/network-stats`) {
              return Promise.resolve({
                data: { data: pooledStakingStats },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: { data: networkStats },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: poolToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_POOLED_DEPOSIT',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              estimatedEntryTime: networkStats.estimated_entry_time_seconds,
              estimatedExitTime: networkStats.estimated_exit_time_seconds,
              estimatedWithdrawalTime:
                networkStats.estimated_withdrawal_time_seconds,
              fee: pooledStakingStats.fee,
              monthlyNrr: pooledStakingStats.one_month.nrr,
              annualNrr: pooledStakingStats.one_year.nrr,
              pool: {
                value: deployment.address,
                name: deployment.display_name,
                logoUri: null,
              },
              exchangeRate: rate.toString(),
              poolToken: {
                address: poolToken.address,
                decimals: 18,
                logoUri: poolToken.logoUri,
                name: poolToken.name,
                symbol: poolToken.symbol,
                trusted: poolToken.trusted,
              },
            });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const to = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not pool-specific', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated') // Not pooling
            .with('status', 'active')
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'pooling')
            .with('status', 'active')
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not active', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling')
            .with('status', 'unknown') // Not active
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the pooled staking stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling')
            .with('status', 'active')
            .build();
          const networkStats = networkStatsBuilder().build();
          const poolToken = tokenBuilder()
            .with('address', deployment.address)
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/onchain/v2/network-stats`) {
              return Promise.reject(new NotFoundException());
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: { data: networkStats },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: poolToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the network stats are not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling')
            .with('status', 'active')
            .build();
          const pooledStakingStats = pooledStakingStatsBuilder()
            .with('address', deployment.address)
            .build();
          const poolToken = tokenBuilder()
            .with('address', deployment.address)
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/onchain/v2/network-stats`) {
              return Promise.resolve({
                data: { data: pooledStakingStats },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.reject(new NotFoundException());
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: poolToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the pool token is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling')
            .with('status', 'active')
            .build();
          const pooledStakingStats = pooledStakingStatsBuilder()
            .with('address', deployment.address)
            .build();
          const networkStats = networkStatsBuilder().build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/onchain/v2/network-stats`) {
              return Promise.resolve({
                data: { data: pooledStakingStats },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: { data: networkStats },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the exchange rate is not available', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling')
            .with('status', 'active')
            .build();
          const pooledStakingStats = pooledStakingStatsBuilder()
            .with('address', deployment.address)
            .build();
          const networkStats = networkStatsBuilder().build();
          const poolToken = tokenBuilder()
            .with('address', deployment.address)
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: parseAbi(['function stake() external payable']),
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/onchain/v2/network-stats`) {
              return Promise.resolve({
                data: { data: pooledStakingStats },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
              return Promise.resolve({
                data: { data: networkStats },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: poolToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockRejectedValue(new NotFoundException());

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });
      });

      [
        {
          method: 'requestExit',
          data: encodeFunctionData({
            abi: parseAbi(['function requestExit(uint256 amount) external']),
            args: [faker.number.bigInt()],
          }),
          type: 'KILN_POOLED_REQUEST_EXIT',
        },
        {
          method: 'multiClaim',
          data: encodeFunctionData({
            abi: parseAbi([
              'function multiClaim(address[] exitQueues, uint256[][] ticketIds, uint32[][] casksIds) external',
            ]),
            args: [
              [getAddress(faker.finance.ethereumAddress())],
              [[faker.number.bigInt()]],
              [[faker.number.int()]],
            ],
          }),
          type: 'KILN_POOLED_MULTI_CLAIM',
        },
      ].map(({ method, data, type }) => {
        describe(method, () => {
          it(`returns the pooled staking \`${method}\` confirmation view`, async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('product_type', 'pooling')
              .with('status', 'active')
              .build();
            const networkStats = networkStatsBuilder().build();
            const poolToken = tokenBuilder()
              .with('address', deployment.address)
              .build();
            const rate = faker.number.bigInt();
            const safeAddress = faker.finance.ethereumAddress();
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
                return Promise.resolve({
                  data: { data: networkStats },
                  status: 200,
                });
              }
              if (
                url ===
                `${chain.transactionService}/api/v1/tokens/${deployment.address}`
              ) {
                return Promise.resolve({
                  data: poolToken,
                  status: 200,
                });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            readContractMock.mockResolvedValue(rate);

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type,
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
                estimatedEntryTime: networkStats.estimated_entry_time_seconds,
                estimatedExitTime: networkStats.estimated_exit_time_seconds,
                estimatedWithdrawalTime:
                  networkStats.estimated_withdrawal_time_seconds,
                pool: {
                  value: deployment.address,
                  name: deployment.display_name,
                  logoUri: null,
                },
                exchangeRate: rate.toString(),
                poolToken: {
                  address: poolToken.address,
                  decimals: poolToken.decimals,
                  logoUri: poolToken.logoUri,
                  name: poolToken.name,
                  symbol: poolToken.symbol,
                  trusted: poolToken.trusted,
                },
              });
          });

          it('returns the generic confirmation view if the deployment is not available', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const safeAddress = faker.finance.ethereumAddress();
            const to = faker.finance.ethereumAddress();
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.reject(new NotFoundException());
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });

          it('returns the generic confirmation view if the deployment is not pool-specific', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('product_type', 'dedicated') // Not pooling
              .with('status', 'active')
              .build();
            const safeAddress = faker.finance.ethereumAddress();
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });

          it('returns the generic confirmation view if the deployment chain is unknown', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('chain', 'unknown') // Unknown
              .with('product_type', 'pooling')
              .with('status', 'active')
              .build();
            const safeAddress = faker.finance.ethereumAddress();
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });

          it('returns the generic confirmation view if the deployment status is unknown', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('product_type', 'pooling')
              .with('status', 'unknown') // Unknown
              .build();
            const safeAddress = faker.finance.ethereumAddress();
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });

          it('returns the generic confirmation view if the network stats are not available', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('product_type', 'pooling')
              .with('status', 'active')
              .build();
            const poolToken = tokenBuilder()
              .with('address', deployment.address)
              .build();
            const rate = faker.number.bigInt();
            const safeAddress = faker.finance.ethereumAddress();
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
                return Promise.reject(new NotFoundException());
              }
              if (
                url ===
                `${chain.transactionService}/api/v1/tokens/${deployment.address}`
              ) {
                return Promise.resolve({
                  data: poolToken,
                  status: 200,
                });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            readContractMock.mockResolvedValue(rate);

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });

          it('returns the generic confirmation view if the pool token is not available', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('product_type', 'pooling')
              .with('status', 'active')
              .build();
            const networkStats = networkStatsBuilder().build();
            const rate = faker.number.bigInt();
            const safeAddress = faker.finance.ethereumAddress();
            const data = encodeFunctionData({
              abi: parseAbi(['function requestExit(uint256 amount) external']),
              args: [faker.number.bigInt()],
            });
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
                return Promise.resolve({
                  data: { data: networkStats },
                  status: 200,
                });
              }
              if (
                url ===
                `${chain.transactionService}/api/v1/tokens/${deployment.address}`
              ) {
                return Promise.reject(new NotFoundException());
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            readContractMock.mockResolvedValue(rate);

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });

          it('returns the generic confirmation view if the exchange rate is not available', async () => {
            const chain = chainBuilder().with('isTestnet', false).build();
            const dataDecoded = dataDecodedBuilder().build();
            const deployment = deploymentBuilder()
              .with('chain_id', +chain.chainId)
              .with('product_type', 'pooling')
              .with('status', 'active')
              .build();
            const networkStats = networkStatsBuilder().build();
            const poolToken = tokenBuilder()
              .with('address', deployment.address)
              .build();
            const safeAddress = faker.finance.ethereumAddress();
            const data = encodeFunctionData({
              abi: parseAbi(['function requestExit(uint256 amount) external']),
              args: [faker.number.bigInt()],
            });
            networkService.get.mockImplementation(({ url }) => {
              if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
                return Promise.resolve({ data: chain, status: 200 });
              }
              if (url === `${stakingApiUrl}/v1/deployments`) {
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              }
              if (url === `${stakingApiUrl}/v1/eth/network-stats`) {
                return Promise.resolve({
                  data: { data: networkStats },
                  status: 200,
                });
              }
              if (
                url ===
                `${chain.transactionService}/api/v1/tokens/${deployment.address}`
              ) {
                return Promise.resolve({
                  data: poolToken,
                  status: 200,
                });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            networkService.post.mockImplementation(({ url }) => {
              if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
                return Promise.resolve({ data: dataDecoded, status: 200 });
              }
              return Promise.reject(new Error(`Could not match ${url}`));
            });
            readContractMock.mockRejectedValue(new NotFoundException());

            await request(app.getHttpServer())
              .post(
                `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
              )
              .send({
                to: deployment.address,
                data,
              })
              .expect(200)
              .expect({
                type: 'GENERIC',
                method: dataDecoded.method,
                parameters: dataDecoded.parameters,
              });
          });
        });
      });
    });

    describe('DeFi', () => {
      const chains = ['1', '42161', '56', '137', '10'];
      describe('deposit', () => {
        it('returns the DeFi vault `deposit` confirmation view', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder().build();
          const vaultToken = tokenBuilder()
            .with('address', deployment.address)
            .with('decimals', null) // Test default decimals
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: vaultToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_DEFI_DEPOSIT',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              fee: 0,
              monthlyNrr: defiVaultStats.nrr,
              annualNrr: defiVaultStats.nrr,
              vault: {
                value: deployment.address,
                name: deployment.display_name,
                logoUri: null,
              },
              exchangeRate: rate.toString(),
              vaultToken: {
                address: vaultToken.address,
                decimals: defiVaultStats.asset_decimals,
                logoUri: vaultToken.logoUri,
                name: vaultToken.name,
                symbol: vaultToken.symbol,
                trusted: vaultToken.trusted,
              },
            });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not defi-specific', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling') // Not defi
            .with('status', 'active')
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not active', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'unknown') // Unknown
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the DeFi vault is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the DeFi vault protocol is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder()
            .with('protocol', 'unknown') // Unknown
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the DeFi vault chain is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder()
            .with('chain', 'unknown') // Unknown
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the exchange rate is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder().build();
          const vaultToken = tokenBuilder()
            .with('address', deployment.address)
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: vaultToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockRejectedValue(new NotFoundException());

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the vault token is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder().build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'deposit',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });
      });

      describe('withdraw', () => {
        it('returns the DeFi vault `withdraw` confirmation view', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder().build();
          const vaultToken = tokenBuilder()
            .with('address', deployment.address)
            .with('decimals', null) // Test default decimals
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: vaultToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'KILN_DEFI_WITHDRAW',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
              vault: {
                value: deployment.address,
                name: deployment.display_name,
                logoUri: null,
              },
              exchangeRate: rate.toString(),
              vaultToken: {
                address: vaultToken.address,
                decimals: defiVaultStats.asset_decimals,
                logoUri: vaultToken.logoUri,
                name: vaultToken.name,
                symbol: vaultToken.symbol,
                trusted: vaultToken.trusted,
              },
            });
        });

        it('returns the generic confirmation view if the deployment is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const safeAddress = faker.finance.ethereumAddress();
          const to = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment is not defi-specific', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'pooling') // Not defi
            .with('status', 'active')
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment chain is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('chain', 'unknown') // Unknown
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the deployment status is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'unknown') // Unknown
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the DeFi vault is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the DeFi vault protocol is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder()
            .with('protocol', 'unknown') // Unknown
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the DeFi vault chain is unknown', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder()
            .with('chain', 'unknown') // Unknown
            .build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the exchange rate is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder().build();
          const vaultToken = tokenBuilder()
            .with('address', deployment.address)
            .build();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.resolve({
                data: vaultToken,
                status: 200,
              });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockRejectedValue(new NotFoundException());

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });

        it('returns the generic confirmation view if the vault token is not available', async () => {
          const chain = chainBuilder()
            .with('chainId', faker.helpers.arrayElement(chains))
            .with('isTestnet', false)
            .build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'defi')
            .with('status', 'active')
            .build();
          const defiVaultStats = defiVaultStatsBuilder().build();
          const rate = faker.number.bigInt();
          const safeAddress = faker.finance.ethereumAddress();
          const data = encodeFunctionData({
            abi: erc4626Abi,
            functionName: 'withdraw',
            args: [
              faker.number.bigInt(),
              getAddress(faker.finance.ethereumAddress()),
              getAddress(faker.finance.ethereumAddress()),
            ],
          });
          networkService.get.mockImplementation(({ url }) => {
            if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
              return Promise.resolve({ data: chain, status: 200 });
            }
            if (url === `${stakingApiUrl}/v1/deployments`) {
              return Promise.resolve({
                data: { data: [deployment] },
                status: 200,
              });
            }
            if (url === `${stakingApiUrl}/v1/defi/network-stats`) {
              return Promise.resolve({
                data: { data: [defiVaultStats] },
                status: 200,
              });
            }
            if (
              url ===
              `${chain.transactionService}/api/v1/tokens/${deployment.address}`
            ) {
              return Promise.reject(new NotFoundException());
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });
          readContractMock.mockResolvedValue(rate);

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/safes/${safeAddress}/views/transaction-confirmation`,
            )
            .send({
              to: deployment.address,
              data,
            })
            .expect(200)
            .expect({
              type: 'GENERIC',
              method: dataDecoded.method,
              parameters: dataDecoded.parameters,
            });
        });
      });
    });
  });

  describe('Swaps', () => {
    it('Gets swap confirmation view with swap data', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: order, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: buyToken, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: sellToken, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            type: 'COW_SWAP_ORDER',
            method: dataDecoded.method,
            parameters: dataDecoded.parameters,
            uid: order.uid,
            status: order.status,
            kind: order.kind,
            orderClass: order.class,
            validUntil: order.validTo,
            sellAmount: order.sellAmount.toString(),
            buyAmount: order.buyAmount.toString(),
            executedSellAmount: order.executedSellAmount.toString(),
            executedBuyAmount: order.executedBuyAmount.toString(),
            explorerUrl: expect.any(String),
            executedSurplusFee: order.executedSurplusFee?.toString() ?? null,
            sellToken: {
              address: sellToken.address,
              decimals: sellToken.decimals,
              logoUri: sellToken.logoUri,
              name: sellToken.name,
              symbol: sellToken.symbol,
              trusted: sellToken.trusted,
            },
            buyToken: {
              address: buyToken.address,
              decimals: buyToken.decimals,
              logoUri: buyToken.logoUri,
              name: buyToken.name,
              symbol: buyToken.symbol,
              trusted: buyToken.trusted,
            },
            receiver: order.receiver,
            owner: order.owner,
            fullAppData: JSON.parse(order.fullAppData as string),
          }),
        );
    });

    it('gets TWAP confirmation view with TWAP data', async () => {
      const ComposableCowAddress = '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74';
      /**
       * @see https://sepolia.etherscan.io/address/0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74
       */
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder()
        .with('address', '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381')
        .build();
      const data =
        '0x0d0d9800000000000000000000000000000000000000000000000000000000000000008000000000000000000000000052ed56da04309aca4c3fecc595298d80c2f16bac000000000000000000000000000000000000000000000000000000000000024000000000000000000000000000000000000000000000000000000000000000010000000000000000000000006cf1e9ca41f7611def408122793c358a3d11e5a500000000000000000000000000000000000000000000000000000019011f294a00000000000000000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000000000000140000000000000000000000000be72e441bf55620febc26715db68d3494213d8cb000000000000000000000000fff9976782d46cc05630d1f6ebab18b2324d6b1400000000000000000000000031eac7f0141837b266de30f4dc9af15629bd538100000000000000000000000000000000000000000000000b941d039eed310b36000000000000000000000000000000000000000000000000087bbc924df9167e0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000007080000000000000000000000000000000000000000000000000000000000000000f7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda00000000000000000000000000000000000000000000000000000000000000000';
      const appDataHash =
        '0xf7be7261f56698c258bf75f888d68a00c85b22fb21958b9009c719eb88aebda0';
      const fullAppData = {
        fullAppData: JSON.stringify({ appCode: swapsVerifiedApp }),
      };
      const dataDecoded = dataDecodedBuilder().build();
      const buyToken = tokenBuilder()
        .with(
          'address',
          getAddress('0xfff9976782d46cc05630d1f6ebab18b2324d6b14'),
        )
        .build();
      const sellToken = tokenBuilder()
        .with(
          'address',
          getAddress('0xbe72e441bf55620febc26715db68d3494213d8cb'),
        )
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${buyToken.address}`
        ) {
          return Promise.resolve({ data: buyToken, status: 200 });
        }
        if (
          url ===
          `${chain.transactionService}/api/v1/tokens/${sellToken.address}`
        ) {
          return Promise.resolve({ data: sellToken, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/app_data/${appDataHash}`) {
          return Promise.resolve({ data: fullAppData, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data,
          to: ComposableCowAddress,
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            type: 'COW_SWAP_TWAP_ORDER',
            method: dataDecoded.method,
            parameters: dataDecoded.parameters,
          }),
        );
    });

    it('Gets Generic confirmation view if order data is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.reject({ status: 500 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('Gets Generic confirmation view if buy token data is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: order, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.reject({ status: 500 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: sellToken, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('Gets Generic confirmation view if sell token data is not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.sellToken).build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: order, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: buyToken, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.reject({ status: 500 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('Gets Generic confirmation view if swap app is restricted', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        // We don't use buzzNoun here as it can generate the same value as verifiedApp
        .with('fullAppData', `{ "appCode": "restrited app code" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: order, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: buyToken, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: sellToken, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect({
          type: 'GENERIC',
          method: dataDecoded.method,
          parameters: dataDecoded.parameters,
        });
    });

    it('executedSurplusFee is rendered as null if not available', async () => {
      const chain = chainBuilder().with('chainId', swapsChainId).build();
      const safe = safeBuilder().build();
      const dataDecoded = dataDecodedBuilder().build();
      const preSignatureEncoder = setPreSignatureEncoder();
      const preSignature = preSignatureEncoder.build();
      const order = orderBuilder()
        .with('uid', preSignature.orderUid)
        .with('executedSurplusFee', null)
        .with('fullAppData', `{ "appCode": "${swapsVerifiedApp}" }`)
        .build();
      const buyToken = tokenBuilder().with('address', order.buyToken).build();
      const sellToken = tokenBuilder().with('address', order.sellToken).build();
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: chain, status: 200 });
        }
        if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
          return Promise.resolve({ data: order, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
        ) {
          return Promise.resolve({ data: buyToken, status: 200 });
        }
        if (
          url === `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
        ) {
          return Promise.resolve({ data: sellToken, status: 200 });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });
      networkService.post.mockImplementation(({ url }) => {
        if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
          return Promise.resolve({
            data: dataDecoded,
            status: 200,
          });
        }
        return Promise.reject(new Error(`Could not match ${url}`));
      });

      await request(app.getHttpServer())
        .post(
          `/v1/chains/${chain.chainId}/safes/${safe.address}/views/transaction-confirmation`,
        )
        .send({
          data: preSignatureEncoder.encode(),
        })
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject({
            type: 'COW_SWAP_ORDER',
            executedSurplusFee: null,
          }),
        );
    });
  });
});
