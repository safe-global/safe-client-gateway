import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { TestCacheModule } from '@/datasources/cache/__tests__/test.cache.module';
import { TestNetworkModule } from '@/datasources/network/__tests__/test.network.module';
import { AppModule } from '@/app.module';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '@/logging/__tests__/test.logging.module';
import configuration from '@/config/entities/__tests__/configuration';
import { IConfigurationService } from '@/config/configuration.service.interface';
import {
  INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import { RequestScopedLoggingModule } from '@/logging/logging.module';
import { previewTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/preview-transaction.dto.builder';
import { CacheModule } from '@/datasources/cache/cache.module';
import { NetworkModule } from '@/datasources/network/network.module';
import { concat, encodeFunctionData, getAddress, parseAbi } from 'viem';
import { TestQueuesApiModule } from '@/datasources/queues/__tests__/test.queues-api.module';
import { QueuesApiModule } from '@/datasources/queues/queues-api.module';
import { Server } from 'net';
import { setPreSignatureEncoder } from '@/domain/swaps/contracts/__tests__/encoders/gp-v2-encoder.builder';
import { orderBuilder } from '@/domain/swaps/entities/__tests__/order.builder';
import { tokenBuilder } from '@/domain/tokens/__tests__/token.builder';
import { deploymentBuilder } from '@/datasources/staking-api/entities/__tests__/deployment.entity.builder';
import { dedicatedStakingStatsBuilder } from '@/datasources/staking-api/entities/__tests__/dedicated-staking-stats.entity.builder';
import { networkStatsBuilder } from '@/datasources/staking-api/entities/__tests__/network-stats.entity.builder';
import {
  Stake,
  StakeState,
} from '@/datasources/staking-api/entities/stake.entity';
import { getNumberString } from '@/domain/common/utils/utils';
import { NULL_ADDRESS } from '@/routes/common/constants';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { stakeBuilder } from '@/datasources/staking-api/entities/__tests__/stake.entity.builder';

describe('Preview transaction - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;
  let swapsChainId: string;
  let swapsApiUrl: string;
  let swapsExplorerUrl: string;
  let stakingApiUrl: string;

  beforeEach(async () => {
    jest.resetAllMocks();

    const baseConfig = configuration();
    const testConfiguration: typeof configuration = () => ({
      ...baseConfig,
      features: {
        ...baseConfig.features,
        nativeStaking: true,
        nativeStakingDecoding: true,
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
      .compile();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    const swapApiConfig =
      configurationService.getOrThrow<Record<string, string>>('swaps.api');
    swapsChainId = faker.helpers.arrayElement(Object.keys(swapApiConfig));
    swapsApiUrl = swapApiConfig[swapsChainId];
    swapsExplorerUrl = configurationService.getOrThrow(`swaps.explorerBaseUri`);
    stakingApiUrl = configurationService.getOrThrow('staking.mainnet.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should throw a validation error', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder().build();
    await request(app.getHttpServer())
      .post(
        `/v1/chains/${faker.string.numeric()}/transactions/${faker.finance.ethereumAddress()}/preview`,
      )
      .send({ ...previewTransactionDto, value: 1 })
      .expect(422)
      .expect({
        statusCode: 422,
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['value'],
        message: 'Expected string, received number',
      });
  });

  it('should preview a "standard" transaction', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', Operation.CALL)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder().build();
    const contractResponse = contractBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
        },
      });
  });

  it('should preview a "standard" transaction with an unknown "to" address', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', Operation.CALL)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
        },
      });
  });

  it('should preview a "standard" transaction even if the data cannot be decoded', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', Operation.CALL)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.reject({ error: 'Data cannot be decoded' });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: null,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: null,
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
        },
      });
  });

  it('should preview a "standard" transaction with a nested call', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', Operation.DELEGATE)
      .build();
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder()
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('valueDecoded', [
            {
              operation: 0,
              data: faker.string.hexadecimal({ length: 32 }),
            },
          ])
          .build(),
      ])
      .build();
    const contractResponse = contractBuilder()
      .with('trustedForDelegateCall', true)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse, status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse, status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse, status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    await request(app.getHttpServer())
      .post(`/v1/chains/${chainId}/transactions/${safeAddress}/preview`)
      .send(previewTransactionDto)
      .expect(200)
      .expect({
        txInfo: {
          type: 'Custom',
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
          richDecodedInfo: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUri,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: true,
          addressInfoIndex: null,
        },
      });
  });

  describe('CoW Swap', () => {
    describe('Swaps', () => {
      it('should preview a transaction', async () => {
        const chain = chainBuilder().with('chainId', swapsChainId).build();
        const safe = safeBuilder().build();
        const dataDecoded = dataDecodedBuilder().build();
        const preSignatureEncoder = setPreSignatureEncoder();
        const preSignature = preSignatureEncoder.build();
        const order = orderBuilder()
          .with('uid', preSignature.orderUid)
          .with('fullAppData', `{ "appCode": "${faker.company.buzzNoun()}" }`)
          .build();
        const buyToken = tokenBuilder().with('address', order.buyToken).build();
        const sellToken = tokenBuilder()
          .with('address', order.sellToken)
          .build();
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('data', preSignatureEncoder.encode())
          .with('operation', Operation.CALL)
          .build();
        const contractResponse = contractBuilder()
          .with('address', previewTransactionDto.to)
          .build();
        networkService.get.mockImplementation(({ url }) => {
          if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
            return Promise.resolve({ data: chain, status: 200 });
          }
          if (url === `${swapsApiUrl}/api/v1/orders/${order.uid}`) {
            return Promise.resolve({ data: order, status: 200 });
          }
          if (
            url ===
            `${chain.transactionService}/api/v1/tokens/${order.buyToken}`
          ) {
            return Promise.resolve({ data: buyToken, status: 200 });
          }
          if (
            url ===
            `${chain.transactionService}/api/v1/tokens/${order.sellToken}`
          ) {
            return Promise.resolve({ data: sellToken, status: 200 });
          }
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({ data: safe, status: 200 });
          }
          if (
            url ===
            `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`
          ) {
            return Promise.resolve({ data: contractResponse, status: 200 });
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
            `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
          )
          .send(previewTransactionDto)
          .expect(200)
          .expect({
            txInfo: {
              type: 'SwapOrder',
              humanDescription: null,
              richDecodedInfo: null,
              uid: order.uid,
              status: order.status,
              kind: order.kind,
              orderClass: order.class,
              validUntil: order.validTo,
              sellAmount: order.sellAmount.toString(),
              buyAmount: order.buyAmount.toString(),
              executedSellAmount: order.executedSellAmount.toString(),
              executedBuyAmount: order.executedBuyAmount.toString(),
              explorerUrl: `${swapsExplorerUrl}orders/${order.uid}`,
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
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
              to: {
                value: previewTransactionDto.to,
                name: contractResponse.displayName,
                logoUri: contractResponse.logoUri,
              },
              value: previewTransactionDto.value,
              operation: previewTransactionDto.operation,
              trustedDelegateCallTarget: null,
              addressInfoIndex: null,
            },
          });
      });

      it.todo('should preview a transaction from a batch');

      it.todo('should return executedSurplusFee as null if not available');

      it.todo(
        'should return a "standard" transaction preview if order data is not available',
      );

      it.todo(
        'should return a "standard" transaction preview if buy token is not available',
      );

      it.todo(
        'should return a "standard" transaction preview if sell token is not available',
      );

      it.todo(
        'should return a "standard" transaction preview if the swap app is restricted',
      );
    });

    describe('TWAPs', () => {
      beforeAll(() => {
        jest.useFakeTimers();
      });

      afterAll(() => {
        jest.useRealTimers();
      });

      it('should preview a transaction', async () => {
        const now = new Date();
        jest.setSystemTime(now);

        const ComposableCowAddress =
          '0xfdaFc9d1902f4e0b84f65F49f244b32b31013b74';
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
        const appData = { appCode: faker.company.buzzNoun() };
        const fullAppData = {
          fullAppData: JSON.stringify(appData),
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
        const previewTransactionDto = previewTransactionDtoBuilder()
          .with('to', ComposableCowAddress)
          .with('data', data)
          .with('operation', Operation.CALL)
          .build();
        const contract = contractBuilder()
          .with('address', ComposableCowAddress)
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
          if (
            url === `${chain.transactionService}/api/v1/safes/${safe.address}`
          ) {
            return Promise.resolve({ data: safe, status: 200 });
          }
          if (
            url ===
            `${chain.transactionService}/api/v1/contracts/${contract.address}`
          ) {
            return Promise.resolve({ data: contract, status: 200 });
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
            `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
          )
          .send(previewTransactionDto)
          .expect(200)
          .expect({
            txInfo: {
              type: 'TwapOrder',
              humanDescription: null,
              richDecodedInfo: null,
              status: 'presignaturePending',
              kind: 'sell',
              class: 'limit',
              activeOrderUid: null,
              validUntil: Math.ceil(now.getTime() / 1_000) + 3599,
              sellAmount: '427173750967724283500',
              buyAmount: '1222579021996502268',
              executedSellAmount: '0',
              executedBuyAmount: '0',
              executedSurplusFee: '0',
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
              receiver: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
              owner: '0x31eaC7F0141837B266De30f4dc9aF15629Bd5381',
              fullAppData: appData,
              numberOfParts: '2',
              partSellAmount: '213586875483862141750',
              minPartLimit: '611289510998251134',
              timeBetweenParts: 1800,
              durationOfPart: { durationType: 'AUTO' },
              startTime: { startType: 'AT_MINING_TIME' },
            },
            txData: {
              hexData: previewTransactionDto.data,
              dataDecoded,
              to: {
                value: ComposableCowAddress,
                name: contract.displayName,
                logoUri: contract.logoUri,
              },
              value: previewTransactionDto.value,
              operation: previewTransactionDto.operation,
              trustedDelegateCallTarget: null,
              addressInfoIndex: null,
            },
          });
      });

      it.todo('should preview a transaction from a batch');

      it.todo(
        'should return a "standard" transaction preview if order data is not available',
      );

      it.todo(
        'should return a "standard" transaction preview if buy token is not available',
      );

      it.todo(
        'should return a "standard" transaction preview if sell token is not available',
      );

      it.todo(
        'should return a "standard" transaction preview if the swap app is restricted',
      );
    });
  });

  describe('Kiln', () => {
    describe('Native (dedicated) staking', () => {
      describe('deposit', () => {
        it('should preview a transaction', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const dataDecoded = dataDecodedBuilder().build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const dedicatedStakingStats = dedicatedStakingStatsBuilder().build();
          const networkStats = networkStatsBuilder().build();
          // Transaction being proposed (no stakes exists)
          const stakes: Array<Stake> = [];
          const safe = safeBuilder().build();
          const data = encodeFunctionData({
            abi: parseAbi(['function deposit() external payable']),
          });
          const value = getNumberString(64 * 10 ** 18 + 1);
          const previewTransactionDto = previewTransactionDtoBuilder()
            .with('data', data)
            .with('operation', Operation.CALL)
            .with('to', deployment.address)
            .with('value', value)
            .build();
          const contractResponse = contractBuilder()
            .with('address', previewTransactionDto.to)
            .build();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/kiln-stats`:
                return Promise.resolve({
                  data: { data: dedicatedStakingStats },
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: { data: networkStats },
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: { data: stakes },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({
                  data: safe,
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
                return Promise.resolve({
                  data: contractResponse,
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          const annualNrr =
            dedicatedStakingStats.gross_apy.last_30d *
            (1 - Number(deployment.product_fee));
          const monthlyNrr = annualNrr / 12;
          const expectedAnnualReward = (annualNrr / 100) * Number(value);
          const expectedMonthlyReward = expectedAnnualReward / 12;
          const expectedFiatAnnualReward =
            (expectedAnnualReward * networkStats.eth_price_usd) /
            Math.pow(10, chain.nativeCurrency.decimals);
          const expectedFiatMonthlyReward = expectedFiatAnnualReward / 12;

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
            )
            .send(previewTransactionDto)
            .expect(200)
            .expect({
              txInfo: {
                type: 'NativeStakingDeposit',
                humanDescription: null,
                richDecodedInfo: null,
                status: 'NOT_STAKED',
                estimatedEntryTime:
                  networkStats.estimated_entry_time_seconds * 1_000,
                estimatedExitTime:
                  networkStats.estimated_exit_time_seconds * 1_000,
                estimatedWithdrawalTime:
                  networkStats.estimated_withdrawal_time_seconds * 1_000,
                fee: +deployment.product_fee!,
                monthlyNrr,
                annualNrr,
                value,
                numValidators: 2,
                expectedAnnualReward: getNumberString(expectedAnnualReward),
                expectedMonthlyReward: getNumberString(expectedMonthlyReward),
                expectedFiatAnnualReward,
                expectedFiatMonthlyReward,
                tokenInfo: {
                  address: NULL_ADDRESS,
                  decimals: chain.nativeCurrency.decimals,
                  logoUri: chain.nativeCurrency.logoUri,
                  name: chain.nativeCurrency.name,
                  symbol: chain.nativeCurrency.symbol,
                  trusted: true,
                },
                validators: null,
              },
              txData: {
                hexData: previewTransactionDto.data,
                dataDecoded,
                to: {
                  value: contractResponse.address,
                  name: contractResponse.displayName,
                  logoUri: contractResponse.logoUri,
                },
                value: previewTransactionDto.value,
                operation: previewTransactionDto.operation,
                trustedDelegateCallTarget: null,
                addressInfoIndex: null,
              },
            });
        });

        it.todo('should preview a transaction with local data decoding');

        it.todo('should preview a transaction from a batch');

        it.todo(
          'should preview a transaction from a batch with local data decoding',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is unavailable',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is not dedicated-specific',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is on an unknown chain',
        );

        it.todo(
          'should return a "standard" transaction preview if not transacting with a deployment address',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment has no product fee',
        );

        it.todo(
          'should return a "standard" transaction preview if the dedicated staking stats are not available',
        );

        it.todo(
          'should return a "standard" transaction preview if the network stats are not available',
        );
      });

      describe('requestValidatorsExit', () => {
        it('should preview a transaction', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safe = safeBuilder().build();
          const networkStats = networkStatsBuilder().build();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              // Transaction Service returns _publicKeys lowercase
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const data = encodeFunctionData({
            abi: parseAbi(['function requestValidatorsExit(bytes)']),
            functionName: 'requestValidatorsExit',
            args: [validatorPublicKey],
          });
          const dataDecoded = dataDecodedBuilder()
            .with('method', 'requestValidatorsExit')
            .with('parameters', [
              {
                name: '_publicKeys',
                type: 'bytes',
                value: validatorPublicKey,
                valueDecoded: null,
              },
            ])
            .build();
          const stakes = [
            stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
            stakeBuilder().with('state', StakeState.ActiveOngoing).build(),
          ];
          const contractResponse = contractBuilder()
            .with('address', deployment.address)
            .build();
          const previewTransactionDto = previewTransactionDtoBuilder()
            .with('data', data)
            .with('operation', Operation.CALL)
            .with('to', deployment.address)
            .build();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/network-stats`:
                return Promise.resolve({
                  data: { data: networkStats },
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: { data: stakes },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({
                  data: safe,
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
                return Promise.resolve({
                  data: contractResponse,
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
            )
            .send(previewTransactionDto)
            .expect(200)
            .expect({
              txInfo: {
                type: 'NativeStakingValidatorsExit',
                humanDescription: null,
                richDecodedInfo: null,
                status: 'ACTIVE',
                estimatedExitTime:
                  networkStats.estimated_exit_time_seconds * 1_000,
                estimatedWithdrawalTime:
                  networkStats.estimated_withdrawal_time_seconds * 1_000,
                value: '64000000000000000000', // 2 x 32 ETH,
                numValidators: 2,
                tokenInfo: {
                  address: NULL_ADDRESS,
                  decimals: chain.nativeCurrency.decimals,
                  logoUri: chain.nativeCurrency.logoUri,
                  name: chain.nativeCurrency.name,
                  symbol: chain.nativeCurrency.symbol,
                  trusted: true,
                },
                validators,
              },
              txData: {
                hexData: previewTransactionDto.data,
                dataDecoded,
                to: {
                  value: contractResponse.address,
                  name: contractResponse.displayName,
                  logoUri: contractResponse.logoUri,
                },
                value: previewTransactionDto.value,
                operation: previewTransactionDto.operation,
                trustedDelegateCallTarget: null,
                addressInfoIndex: null,
              },
            });
        });

        it.todo('should preview a transaction with local data decoding');

        it.todo('should preview a transaction from a batch');

        it.todo(
          'should preview a transaction from a batch with local data decoding',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is unavailable',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is not dedicated-specific',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is on an unknown chain',
        );

        it.todo(
          'should return a "standard" transaction preview if not transacting with a deployment address',
        );

        it.todo(
          'should return a "standard" transaction preview if the network stats are not available',
        );

        it.todo(
          'should return a "standard" transaction preview if the stakes are not available',
        );
      });

      describe('batchWithdrawCLFee', () => {
        it('should preview a transaction', async () => {
          const chain = chainBuilder().with('isTestnet', false).build();
          const deployment = deploymentBuilder()
            .with('chain_id', +chain.chainId)
            .with('product_type', 'dedicated')
            .with('product_fee', faker.number.float().toString())
            .build();
          const safe = safeBuilder().build();
          const validators = [
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              // Transaction Service returns _publicKeys lowercase
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
            faker.string.hexadecimal({
              length: KilnDecoder.KilnPublicKeyLength,
              casing: 'lower',
            }),
          ] as Array<`0x${string}`>;
          const validatorPublicKey = concat(validators);
          const data = encodeFunctionData({
            abi: parseAbi(['function batchWithdrawCLFee(bytes)']),
            functionName: 'batchWithdrawCLFee',
            args: [validatorPublicKey],
          });
          const dataDecoded = dataDecodedBuilder()
            .with('method', 'batchWithdrawCLFee')
            .with('parameters', [
              {
                name: '_publicKeys',
                type: 'bytes',
                value: validatorPublicKey,
                valueDecoded: null,
              },
            ])
            .build();
          const stakes = [
            stakeBuilder()
              .with('net_claimable_consensus_rewards', '1000000')
              .build(),
            stakeBuilder()
              .with('net_claimable_consensus_rewards', '2000000')
              .build(),
          ];
          const contractResponse = contractBuilder()
            .with('address', deployment.address)
            .build();
          const previewTransactionDto = previewTransactionDtoBuilder()
            .with('data', data)
            .with('operation', Operation.CALL)
            .with('to', deployment.address)
            .build();
          networkService.get.mockImplementation(({ url }) => {
            switch (url) {
              case `${safeConfigUrl}/api/v1/chains/${chain.chainId}`:
                return Promise.resolve({ data: chain, status: 200 });
              case `${stakingApiUrl}/v1/deployments`:
                return Promise.resolve({
                  data: { data: [deployment] },
                  status: 200,
                });
              case `${stakingApiUrl}/v1/eth/stakes`:
                return Promise.resolve({
                  data: { data: stakes },
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/safes/${safe.address}`:
                return Promise.resolve({
                  data: safe,
                  status: 200,
                });
              case `${chain.transactionService}/api/v1/contracts/${contractResponse.address}`:
                return Promise.resolve({
                  data: contractResponse,
                  status: 200,
                });
              default:
                return Promise.reject(new Error(`Could not match ${url}`));
            }
          });
          networkService.post.mockImplementation(({ url }) => {
            if (url === `${chain.transactionService}/api/v1/data-decoder/`) {
              return Promise.resolve({ data: dataDecoded, status: 200 });
            }
            return Promise.reject(new Error(`Could not match ${url}`));
          });

          await request(app.getHttpServer())
            .post(
              `/v1/chains/${chain.chainId}/transactions/${safe.address}/preview`,
            )
            .send(previewTransactionDto)
            .expect(200)
            .expect({
              txInfo: {
                type: 'NativeStakingWithdraw',
                humanDescription: null,
                richDecodedInfo: null,
                value: (
                  +stakes[0].net_claimable_consensus_rewards! +
                  +stakes[1].net_claimable_consensus_rewards!
                ).toString(),
                tokenInfo: {
                  address: NULL_ADDRESS,
                  decimals: chain.nativeCurrency.decimals,
                  logoUri: chain.nativeCurrency.logoUri,
                  name: chain.nativeCurrency.name,
                  symbol: chain.nativeCurrency.symbol,
                  trusted: true,
                },
                validators,
              },
              txData: {
                hexData: previewTransactionDto.data,
                dataDecoded,
                to: {
                  value: contractResponse.address,
                  name: contractResponse.displayName,
                  logoUri: contractResponse.logoUri,
                },
                value: previewTransactionDto.value,
                operation: previewTransactionDto.operation,
                trustedDelegateCallTarget: null,
                addressInfoIndex: null,
              },
            });
        });

        it.todo('should preview a transaction with local data decoding');

        it.todo('should preview a transaction from a batch');

        it.todo(
          'should preview a transaction from a batch with local data decoding',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is unavailable',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is not dedicated-specific',
        );

        it.todo(
          'should return a "standard" transaction preview if the deployment is on an unknown chain',
        );

        it.todo(
          'should return a "standard" transaction preview if not transacting with a deployment address',
        );

        it.todo(
          'should return a "standard" transaction preview if the stakes are not available',
        );
      });
    });
  });
});
