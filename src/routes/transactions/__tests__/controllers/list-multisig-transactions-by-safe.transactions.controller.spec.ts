import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { contractBuilder } from '@/domain/data-decoder/v2/entities/__tests__/contract.builder';
import {
  dataDecodedBuilder,
  dataDecodedParameterBuilder,
  multisendBuilder,
} from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { safeAppBuilder } from '@/domain/safe-apps/entities/__tests__/safe-app.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/domain/safe/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import {
  erc20TokenBuilder,
  erc721TokenBuilder,
} from '@/domain/tokens/__tests__/token.builder';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { getAddress } from 'viem';
import type { Server } from 'net';
import { rawify } from '@/validation/entities/raw.entity';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { nativeTokenTransferBuilder } from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
import { createTestModule } from '@/__tests__/testing-module';

describe('List multisig transactions by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const defaultConfiguration = configuration();
    const testConfiguration = (): ReturnType<typeof configuration> => {
      return {
        ...defaultConfiguration,
        features: {
          ...defaultConfiguration.features,
          filterValueParsing: true,
        },
      };
    };

    const moduleFixture = await createTestModule({ config: testConfiguration });

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('Failure: Config API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const error = new NetworkResponseError(
      new URL(
        `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
    });
  });

  it('Failure: Transaction API fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    const error = new NetworkResponseError(
      new URL(
        // Param ValidationPipe checksums address
        `${safeConfigUrl}/v1/chains/${chainId}/safes/${getAddress(safeAddress)}/multisig-transactions`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(500)
      .expect({
        message: 'An error occurred',
        code: 500,
      });

    expect(networkService.get).toHaveBeenCalledTimes(2);
    expect(networkService.get).toHaveBeenCalledWith({
      url: `${safeConfigUrl}/api/v1/chains/${chainId}`,
    });
    expect(networkService.get).toHaveBeenCalledWith({
      // Param ValidationPipe checksums address
      url: `${chainResponse.transactionService}/api/v1/safes/${getAddress(safeAddress)}/multisig-transactions/`,
      networkRequest: expect.objectContaining({
        params: expect.objectContaining({
          ordering: '-nonce',
          safe: getAddress(safeAddress),
          trusted: true,
        }),
      }),
    });
  });

  it('Failure: data validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: rawify({ results: ['invalidData'] }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('Failure: data page validation fails', async () => {
    const chainId = faker.string.numeric();
    const safeAddress = faker.finance.ethereumAddress();
    const chainResponse = chainBuilder().with('chainId', chainId).build();
    const page = pageBuilder().build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: rawify({ ...page, count: 'invalid' }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/multisig-transactions`)
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('Should get a ERC20 transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('value', '0')
      .with('operation', 0)
      .with('executionDate', new Date('2022-11-16T07:31:11Z'))
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('origin', null)
      .with('confirmationsRequired', 2)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers,
      });
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'transfer')
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('name', 'to')
          .with('type', 'address')
          .with('value', '0x84662112A54cC30733A0DfF864bc38905AB42fD4')
          .build(),
        dataDecodedParameterBuilder()
          .with('name', 'value')
          .with('type', 'uint256')
          .with('value', '455753658736')
          .build(),
      ])
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(multisigTransaction.to))
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${multisigTransaction.to}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [multisigTransactionToJson(multisigTransaction)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found', status: 404 });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${safeDecoderUrl}/api/v1/data-decoder`) {
        return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                txHash: multisigTransaction.transactionHash,
                timestamp: multisigTransaction.executionDate?.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: {
                    value: '0x84662112A54cC30733A0DfF864bc38905AB42fD4',
                  },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: token.address,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                    decimals: token.decimals,
                    value: '455753658736',
                  },
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: multisigTransaction.nonce,
                  confirmationsRequired: 2,
                  confirmationsSubmitted: 2,
                  missingSigners: null,
                },
                safeAppInfo: null,
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a ERC721 transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const signers = Array.from({ length: 3 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const token = erc721TokenBuilder()
      .with('address', '0x7Af3460d552f832fD7E2DE973c628ACeA59B0712')
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('to', token.address)
      .with('value', '0')
      .with('operation', 0)
      .with('executionDate', new Date('2022-06-21T23:12:32.000Z'))
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('origin', '{}')
      .with('confirmationsRequired', 3)
      .buildWithConfirmations({
        safe,
        chainId: chain.chainId,
        signers,
      });
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'safeTransferFrom')
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('name', 'from')
          .with('type', 'address')
          .with('value', safe.address)
          .build(),
        dataDecodedParameterBuilder()
          .with('name', 'to')
          .with('type', 'address')
          .with('value', '0x3a55e304D9cF13E45Ead6BA3DabCcadD3a419356')
          .build(),
        dataDecodedParameterBuilder()
          .with('name', 'tokenId')
          .with('type', 'uint256')
          .with('value', '495')
          .build(),
      ])
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/0x7Af3460d552f832fD7E2DE973c628ACeA59B0712`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [multisigTransactionToJson(multisigTransaction)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found', status: 404 });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${safeDecoderUrl}/api/v1/data-decoder`) {
        return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                txHash: multisigTransaction.transactionHash,
                timestamp: 1655853152000,
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: {
                    value: '0x3a55e304D9cF13E45Ead6BA3DabCcadD3a419356',
                  },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC721',
                    tokenAddress: token.address,
                    tokenId: '495',
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                  },
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: multisigTransaction.nonce,
                  confirmationsRequired: 3,
                  confirmationsSubmitted: 3,
                  missingSigners: null,
                },
                safeAppInfo: null,
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a Custom transaction mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safeAppsResponse = [safeAppBuilder().build()];
    const contractResponse = contractBuilder().build();
    const contractPageResponse = pageBuilder()
      .with('results', [contractResponse])
      .build();
    const signers = Array.from({ length: 3 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const domainTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('value', '0')
      .with('data', faker.string.hexadecimal({ length: 32 }) as `0x${string}`)
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('confirmationsRequired', 3)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers,
      });
    const dataDecoded = dataDecodedBuilder()
      .with('method', 'multiSend')
      .with('parameters', [
        dataDecodedParameterBuilder()
          .with('name', 'transactions')
          .with('valueDecoded', [
            multisendBuilder().build(),
            multisendBuilder().build(),
            multisendBuilder().build(),
          ])
          .build(),
      ])
      .build();
    const multisigTransactionsPage = pageBuilder()
      .with('results', [multisigTransactionToJson(domainTransaction)])
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getSafeAppsUrl = `${safeConfigUrl}/api/v1/safe-apps/`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${domainTransaction.safe}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${domainTransaction.safe}`;
      const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getSafeAppsUrl) {
        return Promise.resolve({ data: rawify(safeAppsResponse), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(multisigTransactionsPage),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
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
      if (url === `${safeDecoderUrl}/api/v1/data-decoder`) {
        return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${domainTransaction.safe}/multisig-transactions`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${domainTransaction.safe}_${domainTransaction.safeTxHash}`,
                txHash: domainTransaction.transactionHash,
                timestamp: domainTransaction.executionDate?.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Custom',
                  to: {
                    value: contractResponse.address,
                    name: contractResponse.displayName,
                    logoUri: contractResponse.logoUrl,
                  },
                  dataSize: '16',
                  value: domainTransaction.value,
                  methodName: dataDecoded.method,
                  actionCount: 3,
                  isCancellation: false,
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: domainTransaction.nonce,
                  confirmationsRequired:
                    domainTransaction.confirmationsRequired,
                  confirmationsSubmitted:
                    domainTransaction.confirmations?.length,
                  missingSigners: null,
                },
                safeAppInfo: {
                  logoUri: safeAppsResponse[0].iconUrl,
                  name: safeAppsResponse[0].name,
                  url: safeAppsResponse[0].url,
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  // Note: endpoint only supports native coin
  it('should parse values as Ether', async () => {
    const chain = chainBuilder().build();
    const signers = Array.from({ length: 2 }, () => {
      const privateKey = generatePrivateKey();
      return privateKeyToAccount(privateKey);
    });
    const safe = safeBuilder()
      .with(
        'owners',
        signers.map((signer) => signer.address),
      )
      .build();
    const value = faker.number.int({ min: 1, max: 100 });
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('value', BigInt(value * 10 ** 18).toString())
      .build();
    const multisigTransaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('value', nativeTokenTransfer.value)
      .with('operation', 0)
      .with('executionDate', nativeTokenTransfer.executionDate)
      .with('isExecuted', true)
      .with('isSuccessful', true)
      .with('origin', null)
      .with('to', nativeTokenTransfer.to)
      .with('confirmationsRequired', 2)
      .buildWithConfirmations({
        chainId: chain.chainId,
        safe,
        signers,
      });
    const dataDecoded = dataDecodedBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getMultisigTransactionsUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/multisig-transactions/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getMultisigTransactionsUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [multisigTransactionToJson(multisigTransaction)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found', status: 404 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${safeDecoderUrl}/api/v1/data-decoder`) {
        return Promise.resolve({ data: rawify(dataDecoded), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/multisig-transactions/?value=${value}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `multisig_${safe.address}_${multisigTransaction.safeTxHash}`,
                txHash: multisigTransaction.transactionHash,
                timestamp: multisigTransaction.executionDate?.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: {
                    value: multisigTransaction.to,
                  },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: multisigTransaction.value,
                  },
                },
                executionInfo: {
                  type: 'MULTISIG',
                  nonce: multisigTransaction.nonce,
                  confirmationsRequired: 2,
                  confirmationsSubmitted: 2,
                  missingSigners: null,
                },
                safeAppInfo: null,
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });
});
