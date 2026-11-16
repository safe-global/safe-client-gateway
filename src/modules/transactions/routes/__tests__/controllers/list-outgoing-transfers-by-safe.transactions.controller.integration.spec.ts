// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { NetworkResponseError } from '#/datasources/network/entities/network.error.entity';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import {
  limitAndOffsetUrlFactory,
  pageBuilder,
} from '#/domain/entities/__tests__/page.builder';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import {
  erc20TransferBuilder,
  toJson as erc20TransferToJson,
} from '#/modules/safe/domain/entities/__tests__/erc20-transfer.builder';
import {
  erc721TransferBuilder,
  toJson as erc721TransferToJson,
} from '#/modules/safe/domain/entities/__tests__/erc721-transfer.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import {
  erc20TokenBuilder,
  erc721TokenBuilder,
} from '#/modules/tokens/domain/__tests__/token.builder';
import type { Token } from '#/modules/tokens/domain/entities/token.entity';
import { rawify } from '#/validation/entities/raw.entity';

describe('List outgoing transfers by Safe - Transactions Controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let safeDecoderUrl: string;
  let networkService: MockedObject<INetworkService>;

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleFixture = await createTestModule();
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    safeDecoderUrl = configurationService.getOrThrow('safeDataDecoder.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app?.close();
  });

  function mockNetwork(args: {
    chain: Chain;
    safe: Safe;
    transfers: Array<unknown>;
    token: Token;
    next?: string | null;
    previous?: string | null;
  }): void {
    networkService.get.mockImplementation(({ url }) => {
      const getChainUrl = `${safeConfigUrl}/api/v1/chains/${args.chain.chainId}`;
      const getTransfersUrl = `${args.chain.transactionService}/api/v1/safes/${args.safe.address}/transfers/`;
      const getSafeUrl = `${args.chain.transactionService}/api/v1/safes/${args.safe.address}`;
      const getContractUrlPattern = `${safeDecoderUrl}/api/v1/contracts/`;
      const getTokenUrl = `${args.chain.transactionService}/api/v1/tokens/${args.token.address}`;
      if (url === getChainUrl) {
        return Promise.resolve({ data: rawify(args.chain), status: 200 });
      }
      if (url === getTransfersUrl) {
        return Promise.resolve({
          data: rawify(
            pageBuilder()
              .with('results', args.transfers)
              .with('next', args.next ?? null)
              .with('previous', args.previous ?? null)
              .build(),
          ),
          status: 200,
        });
      }
      if (url === getSafeUrl) {
        return Promise.resolve({ data: rawify(args.safe), status: 200 });
      }
      if (url.includes(getContractUrlPattern)) {
        return Promise.reject({ detail: 'Not found' });
      }
      if (url === getTokenUrl) {
        return Promise.resolve({ data: rawify(args.token), status: 200 });
      }
      return Promise.reject(new Error(`Could not match ${url}`));
    });
  }

  it('should forward the recipient, token and date filters to the Transaction Service, with the Safe as sender', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const to = getAddress(faker.finance.ethereumAddress());
    const token = erc20TokenBuilder().with('trusted', true).build();
    const executionDateGte = faker.date.past().toISOString();
    const executionDateLte = faker.date.recent().toISOString();
    mockNetwork({ chain, safe, transfers: [], token });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({
        to,
        token_address: token.address,
        execution_date__gte: executionDateGte,
        execution_date__lte: executionDateLte,
      })
      .expect(200);

    expect(networkService.get).toHaveBeenCalledWith({
      url: `${chain.transactionService}/api/v1/safes/${safe.address}/transfers/`,
      networkRequest: expect.objectContaining({
        params: expect.objectContaining({
          to,
          _from: safe.address,
          token_address: token.address,
          execution_date__gte: executionDateGte,
          execution_date__lte: executionDateLte,
        }),
      }),
    });
  });

  it('should ignore a from query param and always send the Safe as sender', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const from = getAddress(faker.finance.ethereumAddress());
    const token = erc20TokenBuilder().with('trusted', true).build();
    mockNetwork({ chain, safe, transfers: [], token });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({ from })
      .expect(200);

    expect(networkService.get).toHaveBeenCalledWith({
      url: `${chain.transactionService}/api/v1/safes/${safe.address}/transfers/`,
      networkRequest: expect.objectContaining({
        params: expect.objectContaining({ _from: safe.address }),
      }),
    });
  });

  it('should return an ERC-20 transfer sent by the Safe as outgoing to its recipient', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const erc20Transfer = erc20TransferBuilder()
      .with('from', safe.address)
      .with('to', recipient)
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', true)
      .build();
    mockNetwork({
      chain,
      safe,
      transfers: [erc20TransferToJson(erc20Transfer)],
      token,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({ to: recipient })
      .expect(200)
      .then(({ body }) => {
        expect(body).toMatchObject({
          results: [
            {
              type: 'TRANSACTION',
              transaction: {
                txHash: erc20Transfer.transactionHash,
                txStatus: 'SUCCESS',
                txInfo: {
                  type: 'Transfer',
                  sender: { value: safe.address },
                  recipient: { value: recipient },
                  direction: 'OUTGOING',
                  transferInfo: {
                    type: 'ERC20',
                    tokenAddress: erc20Transfer.tokenAddress,
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

  it('should drop transfers of untrusted tokens by default', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const erc20Transfer = erc20TransferBuilder()
      .with('from', safe.address)
      .with('to', recipient)
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', false)
      .build();
    mockNetwork({
      chain,
      safe,
      transfers: [erc20TransferToJson(erc20Transfer)],
      token,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({ to: recipient })
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toEqual([]);
      });
  });

  it('should return transfers of untrusted tokens when trusted is false', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const erc20Transfer = erc20TransferBuilder()
      .with('from', safe.address)
      .with('to', recipient)
      .with('value', faker.number.int({ min: 1 }).toString())
      .build();
    const token = erc20TokenBuilder()
      .with('address', getAddress(erc20Transfer.tokenAddress))
      .with('trusted', false)
      .build();
    mockNetwork({
      chain,
      safe,
      transfers: [erc20TransferToJson(erc20Transfer)],
      token,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({ to: recipient, trusted: 'false' })
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(1);
        expect(body.results[0].transaction.txHash).toBe(
          erc20Transfer.transactionHash,
        );
      });
  });

  it('should return ERC-721 transfers of untrusted tokens, as only ERC-20 transfers are filtered by trust', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const erc721Transfer = erc721TransferBuilder()
      .with('from', safe.address)
      .with('to', recipient)
      .build();
    const token = erc721TokenBuilder()
      .with('address', getAddress(erc721Transfer.tokenAddress))
      .with('trusted', false)
      .build();
    mockNetwork({
      chain,
      safe,
      transfers: [erc721TransferToJson(erc721Transfer)],
      token,
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({ to: recipient })
      .expect(200)
      .then(({ body }) => {
        expect(body.results).toHaveLength(1);
        expect(body.results[0].transaction.txInfo.transferInfo.type).toBe(
          'ERC721',
        );
      });
  });

  it('should forward the cursor and return next and previous cursors that keep the filters', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const recipient = getAddress(faker.finance.ethereumAddress());
    const token = erc20TokenBuilder().with('trusted', true).build();
    const limit = faker.number.int({ min: 1, max: 50 });
    const offset = faker.number.int({ min: 1, max: 50 }) * limit;
    const transfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/transfers/`;
    mockNetwork({
      chain,
      safe,
      transfers: [],
      token,
      next: limitAndOffsetUrlFactory(limit, offset + limit, transfersUrl),
      previous: limitAndOffsetUrlFactory(limit, offset - limit, transfersUrl),
    });

    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({
        cursor: `limit=${limit}&offset=${offset}`,
        to: recipient,
        trusted: 'false',
      })
      .expect(200);

    expect(networkService.get).toHaveBeenCalledWith({
      url: transfersUrl,
      networkRequest: expect.objectContaining({
        params: expect.objectContaining({ limit, offset }),
      }),
    });
    const next = new URL(body.next);
    const previous = new URL(body.previous);
    expect(next.searchParams.get('cursor')).toBe(
      `limit=${limit}&offset=${offset + limit}`,
    );
    expect(previous.searchParams.get('cursor')).toBe(
      `limit=${limit}&offset=${offset - limit}`,
    );
    for (const url of [next, previous]) {
      expect(url.searchParams.get('to')).toBe(recipient);
      expect(url.searchParams.get('trusted')).toBe('false');
    }
  });

  it.each([
    ['to', faker.string.alpha(10)],
    ['token_address', faker.string.alpha(10)],
    ['execution_date__gte', faker.string.alpha(10)],
    ['execution_date__lte', faker.string.alpha(10)],
    ['trusted', faker.string.alpha(10)],
  ])('should reject an invalid %s', async (param, value) => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .query({ [param]: value })
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('should reject an invalid chain ID', async () => {
    const safe = safeBuilder().build();

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${faker.string.alpha(5)}/safes/${safe.address}/outgoing-transfers/`,
      )
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('should return the Transaction Service error status when the transfers request fails', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const transfersUrl = `${chain.transactionService}/api/v1/safes/${safe.address}/transfers/`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === `${chain.transactionService}/api/v1/safes/${safe.address}`) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      return Promise.reject(
        new NetworkResponseError(new URL(transfersUrl), {
          status: 500,
        } as Response),
      );
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .expect(500)
      .expect({ message: 'An error occurred', code: 500 });
  });

  it('should return 404 when the Safe is not found', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    const getSafeUrl = `${chain.transactionService}/api/v1/safes/${safe.address}`;
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === getSafeUrl) {
        return Promise.reject(
          new NetworkResponseError(new URL(getSafeUrl), {
            status: 404,
          } as Response),
        );
      }
      return Promise.resolve({
        data: rawify(pageBuilder().build()),
        status: 200,
      });
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .expect(404);
  });

  it('should return 502 when the Transaction Service returns a malformed page', async () => {
    const chain = chainBuilder().build();
    const safe = safeBuilder().build();
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === `${chain.transactionService}/api/v1/safes/${safe.address}`) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      return Promise.resolve({
        data: rawify({ results: [faker.string.alpha()] }),
        status: 200,
      });
    });

    await request(app.getHttpServer())
      .get(
        `/v1/chains/${chain.chainId}/safes/${safe.address}/outgoing-transfers/`,
      )
      .expect(502)
      .expect({ statusCode: 502, message: 'Bad gateway' });
  });
});
