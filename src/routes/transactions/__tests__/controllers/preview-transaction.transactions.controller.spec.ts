import { faker } from '@faker-js/faker';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { TestAppProvider } from '../../../../app.provider';
import {
  fakeConfigurationService,
  TestConfigurationModule,
} from '../../../../config/__tests__/test.configuration.module';
import {
  fakeCacheService,
  TestCacheModule,
} from '../../../../datasources/cache/__tests__/test.cache.module';
import {
  mockNetworkService,
  TestNetworkModule,
} from '../../../../datasources/network/__tests__/test.network.module';
import { DomainModule } from '../../../../domain.module';
import { chainBuilder } from '../../../../domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '../../../../domain/contracts/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
} from '../../../../domain/data-decoder/entities/__tests__/data-decoded.builder';
import {
  CALL_OPERATION,
  DELEGATE_OPERATION,
} from '../../../../domain/safe/entities/operation.entity';
import { safeBuilder } from '../../../../domain/safe/entities/__tests__/safe.builder';
import { TestLoggingModule } from '../../../../logging/__tests__/test.logging.module';
import { ValidationModule } from '../../../../validation/validation.module';
import { previewTransactionDtoBuilder } from '../../entities/__tests__/preview-transaction.dto.builder';
import { TransactionsModule } from '../../transactions.module';

describe('Preview transaction - Transactions Controller (Unit)', () => {
  let app: INestApplication;
  let safeConfigApiUrl: string;

  beforeAll(async () => {
    safeConfigApiUrl = faker.internet.url();
    fakeConfigurationService.set('safeConfig.baseUri', safeConfigApiUrl);
    fakeConfigurationService.set('exchange.baseUri', faker.internet.url());
    fakeConfigurationService.set('exchange.apiKey', faker.datatype.uuid());
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeCacheService.clear();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        // feature
        TransactionsModule,
        // common
        DomainModule,
        TestCacheModule,
        TestConfigurationModule,
        TestLoggingModule,
        TestNetworkModule,
        ValidationModule,
      ],
    }).compile();

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
        `/v1/chains/${faker.random.numeric()}/transactions/${faker.datatype.hexadecimal(
          16,
        )}/preview`,
      )
      .send({ ...previewTransactionDto, value: 1 })
      .expect(400);
  });

  it('should preview a transaction', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', CALL_OPERATION)
      .build();
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder().build();
    const contractResponse = contractBuilder().build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    mockNetworkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse });
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
          addressInfoIndex: {},
        },
      });
  });

  it('should preview a transaction with an unknown "to" address', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', CALL_OPERATION)
      .build();
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder().build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    mockNetworkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse });
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
          addressInfoIndex: {},
        },
      });
  });

  it('should preview a transaction even if the data cannot be decoded', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', CALL_OPERATION)
      .build();
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    mockNetworkService.post.mockImplementation((url) => {
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
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: previewTransactionDto.data,
          to: {
            value: previewTransactionDto.to,
            name: null,
            logoUri: null,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: {},
        },
      });
  });

  it('should preview a transaction with a nested delegate call', async () => {
    const previewTransactionDto = previewTransactionDtoBuilder()
      .with('operation', DELEGATE_OPERATION)
      .build();
    const chainId = faker.random.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const safeResponse = safeBuilder().with('address', safeAddress).build();
    const chainResponse = chainBuilder().build();
    const dataDecodedResponse = dataDecodedBuilder()
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('valueDecoded', [
            {
              operation: 1,
              data: faker.datatype.hexadecimal(32),
            },
          ])
          .build(),
      ])
      .build();
    const contractResponse = contractBuilder()
      .with('trustedForDelegateCall', true)
      .build();
    mockNetworkService.get.mockImplementation((url) => {
      const getChainUrl = `${safeConfigApiUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${chainResponse.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: chainResponse });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: safeResponse });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({ data: contractResponse });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    mockNetworkService.post.mockImplementation((url) => {
      const getDataDecodedUrl = `${chainResponse.transactionService}/api/v1/data-decoder/`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({ data: dataDecodedResponse });
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
          addressInfoIndex: {},
        },
      });
  });
});
