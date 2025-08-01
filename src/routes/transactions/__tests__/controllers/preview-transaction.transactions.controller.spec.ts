import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
  multisendBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { previewTransactionDtoBuilder } from '@/routes/transactions/entities/__tests__/preview-transaction.dto.builder';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { createTestModule } from '@/__tests__/testing-module';

describe('Preview transaction - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let dataDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleFixture = await createTestModule({ overridePostgresV2: false });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    dataDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
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
    const contractPageResponse = pageBuilder()
      .with('results', [contractResponse])
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${dataDecoderUrl}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contractPageResponse),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${dataDecoderUrl}/api/v1/data-decoder`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({
          data: rawify(dataDecodedResponse),
          status: 200,
        });
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
            logoUri: contractResponse.logoUrl,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUrl,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: null,
          addressInfoIndex: null,
          tokenInfoIndex: null,
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
      const getContractUrlPattern = `${dataDecoderUrl}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${dataDecoderUrl}/api/v1/data-decoder`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({
          data: rawify(dataDecodedResponse),
          status: 200,
        });
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
          tokenInfoIndex: null,
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
      const getContractUrlPattern = `${dataDecoderUrl}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${dataDecoderUrl}/api/v1/data-decoder`;
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
          tokenInfoIndex: null,
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
            multisendBuilder().with('operation', 0).build(),
          ])
          .build(),
      ])
      .build();
    const contractResponse = contractBuilder()
      .with('trustedForDelegateCall', true)
      .build();
    const contractPageResponse = pageBuilder()
      .with('results', [contractResponse])
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chainId}`;
      const getSafeUrl = `${chainResponse.transactionService}/api/v1/safes/${safeAddress}`;
      const getContractUrlPattern = `${dataDecoderUrl}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chainResponse), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safeResponse), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.resolve({
          data: rawify(contractPageResponse),
          status: 200,
        });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      const getDataDecodedUrl = `${dataDecoderUrl}/api/v1/data-decoder`;
      if (url === getDataDecodedUrl) {
        return Promise.resolve({
          data: rawify(dataDecodedResponse),
          status: 200,
        });
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
            logoUri: contractResponse.logoUrl,
          },
          dataSize: '16',
          value: previewTransactionDto.value,
          methodName: dataDecodedResponse.method,
          actionCount: null,
          isCancellation: false,
          humanDescription: null,
        },
        txData: {
          hexData: previewTransactionDto.data,
          dataDecoded: dataDecodedResponse,
          to: {
            value: contractResponse.address,
            name: contractResponse.displayName,
            logoUri: contractResponse.logoUrl,
          },
          value: previewTransactionDto.value,
          operation: previewTransactionDto.operation,
          trustedDelegateCallTarget: true,
          addressInfoIndex: null,
          tokenInfoIndex: null,
        },
      });
  });
});
