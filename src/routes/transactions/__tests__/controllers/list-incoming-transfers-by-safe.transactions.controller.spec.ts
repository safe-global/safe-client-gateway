import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '@/domain/safe/entities/__tests__/erc20-transfer.builder';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '@/domain/safe/entities/__tests__/erc721-transfer.builder';
import {
  nativeTokenTransferBuilder,
  toJson as nativeTokenTransferToJson,
} from '@/domain/safe/entities/__tests__/native-token-transfer.builder';
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
import { createTestModule } from '@/__tests__/testing-module';

describe('List incoming transfers by Safe - Transactions Controller (Unit)', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: jest.MockedObjectDeep<INetworkService>;

  beforeEach(async () => {
    jest.resetAllMocks();

    const moduleFixture = await createTestModule();
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
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
        `${safeConfigUrl}/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
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
    const limit = faker.number.int({ min: 0, max: 100 });
    const offset = faker.number.int({ min: 0, max: 100 });
    networkService.get.mockResolvedValueOnce({
      data: rawify(chainResponse),
      status: 200,
    });
    const error = new NetworkResponseError(
      new URL(
        // Param ValidationPipe checksums address
        `${chainResponse.transactionService}/v1/chains/${chainId}/safes/${getAddress(safeAddress)}/incoming-transfers/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      ),
      { status: 500 } as Response,
    );
    networkService.get.mockRejectedValueOnce(error);

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers/?cursor=limit%3D${limit}%26offset%3D${offset}`,
      )
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
      url: `${chainResponse.transactionService}/api/v1/safes/${getAddress(safeAddress)}/incoming-transfers/`,
      networkRequest: expect.objectContaining({
        params: expect.objectContaining({ offset, limit }),
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
      .get(`/v1/chains/${chainId}/safes/${safeAddress}/incoming-transfers`)
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('Failure: data page validation fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const page = pageBuilder().build();
    networkService.get.mockResolvedValueOnce({
      data: rawify(chain),
      status: 200,
    });
    networkService.get.mockResolvedValueOnce({
      data: rawify({ ...page, next: faker.datatype.boolean() }),
      status: 200,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/`,
      )
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });

  it('Should get a trusted ERC20 incoming transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const erc20Transfer = erc20TransferBuilder()
      .with('executionDate', new Date('2022-11-07T09:03:48Z'))
      .with('to', safe.address)
      .with('from', safe.address)
      .with('transferId', 'e1015fc6905')
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', true)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${erc20Transfer.tokenAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [erc20TransferToJson(erc20Transfer)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_e1015fc6905`,
                txHash: erc20Transfer.transactionHash,
                executionInfo: null,
                safeAppInfo: null,
                timestamp: erc20Transfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: { value: safe.address },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: erc20Transfer.tokenAddress,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                    decimals: token.decimals,
                    value: erc20Transfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a non-trusted ERC20 incoming transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const erc20Transfer = erc20TransferBuilder()
      .with('executionDate', new Date('2022-11-07T09:03:48Z'))
      .with('to', safe.address)
      .with('from', safe.address)
      .with('transferId', 'e1015fc6905')
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const trusted = false;
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', trusted)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${erc20Transfer.tokenAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [erc20TransferToJson(erc20Transfer)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/?trusted=${trusted}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_e1015fc6905`,
                txHash: erc20Transfer.transactionHash,
                executionInfo: null,
                safeAppInfo: null,
                timestamp: erc20Transfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: { value: safe.address },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: erc20Transfer.tokenAddress,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                    decimals: token.decimals,
                    value: erc20Transfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should filter out non-trusted ERC20 incoming transfers by default', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const erc20Transfer = erc20TransferBuilder()
      .with('executionDate', new Date('2022-11-07T09:03:48Z'))
      .with('to', safe.address)
      .with('from', safe.address)
      .with('transferId', 'e1015fc6905')
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', false)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${erc20Transfer.tokenAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [erc20TransferToJson(erc20Transfer)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [],
        });
      });
  });

  it('Should get a ERC721 incoming transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const erc721Transfer = erc721TransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('transferId', 'e1015fc6905')
      .build();
    const token = erc721TokenBuilder()
      .with('address', getAddress(erc721Transfer.tokenAddress))
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${erc721Transfer.tokenAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [erc721TransferToJson(erc721Transfer)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_e1015fc6905`,
                txHash: erc721Transfer.transactionHash,
                timestamp: erc721Transfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: erc721Transfer.from },
                  recipient: { value: erc721Transfer.to },
                  direction: 'INCOMING',
                  transferInfo: {
                    type: 'ERC721',
                    tokenAddress: erc721Transfer.tokenAddress,
                    tokenId: erc721Transfer.tokenId,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('Should get a native coin incoming transfer mapped to the expected format', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('value', faker.number.int({ min: 1 }).toString())
      .with('transferId', 'e1015fc690')
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [nativeTokenTransferToJson(nativeTokenTransfer)])
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

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_e1015fc690`,
                txHash: nativeTokenTransfer.transactionHash,
                timestamp: nativeTokenTransfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: nativeTokenTransfer.from },
                  recipient: { value: nativeTokenTransfer.to },
                  direction: 'INCOMING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: nativeTokenTransfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it('should parse native coin values as Ether', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const value = faker.number.int({ min: 1, max: 100 });
    const nativeTokenTransfer = nativeTokenTransferBuilder()
      .with('executionDate', new Date('2022-08-04T12:44:22Z'))
      .with('to', safe.address)
      .with('value', BigInt(value * 10 ** 18).toString())
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [nativeTokenTransferToJson(nativeTokenTransfer)])
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

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/?value=${value}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_${nativeTokenTransfer.transferId}`,
                txHash: nativeTokenTransfer.transactionHash,
                timestamp: nativeTokenTransfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: nativeTokenTransfer.from },
                  recipient: { value: nativeTokenTransfer.to },
                  direction: 'INCOMING',
                  transferInfo: {
                    type: 'NATIVE_COIN',
                    value: nativeTokenTransfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });

  it("should parse tokens value according to it's decimals", async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const value = faker.number.int({ min: 1, max: 100 });
    const decimals = faker.number.int({ min: 1, max: 18 });
    const erc20Transfer = erc20TransferBuilder()
      .with('executionDate', new Date('2022-11-07T09:03:48Z'))
      .with('to', safe.address)
      .with('from', safe.address)
      .with('value', BigInt(value * 10 ** decimals).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', true)
      .with('decimals', decimals)
      .build();
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${chain.chainId}`;
      const getIncomingTransfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/incoming-transfers/`;
      const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
      const getContractUrlPattern = `${chain.transactionService}/api/v1/contracts/`;
      const getTokenUrlPattern = `${chain.transactionService}/api/v1/tokens/${erc20Transfer.tokenAddress}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getIncomingTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', [erc20TransferToJson(erc20Transfer)])
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrlPattern) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/incoming-transfers/?tokenAddress=${erc20Transfer.tokenAddress}&value=${value}`,
      )
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                id: `transfer_${safe.address}_${erc20Transfer.transferId}`,
                txHash: erc20Transfer.transactionHash,
                executionInfo: null,
                safeAppInfo: null,
                timestamp: erc20Transfer.executionDate.getTime(),
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: { value: safe.address },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: erc20Transfer.tokenAddress,
                    tokenName: token.name,
                    tokenSymbol: token.symbol,
                    logoUri: token.logoUri,
                    decimals: token.decimals,
                    value: erc20Transfer.value,
                  },
                },
              },
              conflictType: 'None',
            },
          ],
        });
      });
  });
});
