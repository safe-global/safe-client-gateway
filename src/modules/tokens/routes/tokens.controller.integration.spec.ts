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
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import {
  erc20TokenBuilder,
  nativeTokenBuilder,
} from '@/modules/tokens/domain/__tests__/token.builder';
import type { Token } from '@/modules/tokens/domain/entities/token.entity';
import { MAX_TOKEN_ADDRESSES } from '@/modules/tokens/routes/entities/token-addresses.dto.entity';
import { rawify } from '@/validation/entities/raw.entity';

describe('Tokens controller', () => {
  let app: INestApplication<Server>;
  let safeConfigUrl: string;
  let networkService: MockedObject<INetworkService>;

  // chainBuilder()'s default chainId is a single digit (faker.string.numeric()),
  // and TransactionApiManager caches one API instance per chainId for the
  // lifetime of this describe block's shared `app`. With 12 tests sharing one
  // app, two tests drawing the same digit is near-certain and makes the later
  // test silently reuse the earlier test's (wrong-host) cached client. Forcing
  // a unique chainId per test removes that cross-test collision without
  // changing any assertion.
  let nextChainId = 1;
  const uniqueChainId = (): string => `${1000 + nextChainId++}`;

  beforeAll(async () => {
    const moduleFixture = await createTestModule();

    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  const tokenUrl = (chain: Chain, address: string): string =>
    `${chain.transactionService}/api/v1/tokens/${address}`;

  /** Chain config resolves; each known token resolves; each listed address in `notFound` 404s. */
  const mockUpstream = (
    chain: Chain,
    tokens: Array<Token>,
    notFound: Array<string> = [],
  ): void => {
    networkService.get.mockImplementation(({ url }) => {
      if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      const token = tokens.find(
        (item) => url === tokenUrl(chain, item.address),
      );
      if (token) {
        return Promise.resolve({ data: rawify(token), status: 200 });
      }
      if (notFound.some((address) => url === tokenUrl(chain, address))) {
        return Promise.reject(
          new NetworkResponseError(new URL(url), { status: 404 } as Response),
        );
      }
      return Promise.reject(
        new NetworkResponseError(new URL(url), { status: 418 } as Response),
      );
    });
  };

  describe('GET /v1/chains/:chainId/tokens/:address', () => {
    it('returns an ERC-20 token', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const token = erc20TokenBuilder().build();
      mockUpstream(chain, [token]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens/${token.address}`)
        .expect(200)
        .expect(token);
    });

    it('returns the native token entry', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const token = nativeTokenBuilder().build();
      mockUpstream(chain, [token]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens/${token.address}`)
        .expect(200)
        .expect(token);
    });

    it('returns 404 when the Transaction Service does not know the token', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const address = getAddress(faker.finance.ethereumAddress());
      mockUpstream(chain, [], [address]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens/${address}`)
        .expect(404);
    });

    it('returns 422 for a malformed address', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens/0xnot-an-address`)
        .expect(422);
      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('returns 503 when the Config Service fails', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const token = erc20TokenBuilder().build();
      networkService.get.mockRejectedValue(new Error());

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens/${token.address}`)
        .expect(503);
    });
  });

  describe('GET /v1/chains/:chainId/tokens?addresses=', () => {
    it('returns the known tokens in request order and omits unknown ones', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const first = erc20TokenBuilder().build();
      const second = erc20TokenBuilder().build();
      const unknown = getAddress(faker.finance.ethereumAddress());
      mockUpstream(chain, [first, second], [unknown]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({
          addresses: [first.address, unknown, second.address].join(','),
        })
        .expect(200)
        .expect([first, second]);
    });

    it('looks a duplicated address up once and returns it once', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const token = erc20TokenBuilder().build();
      mockUpstream(chain, [token]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({ addresses: `${token.address},${token.address.toLowerCase()}` })
        .expect(200)
        .expect([token]);
      // R-005 exception: the same mock also serves the chain-config call, so
      // toHaveBeenCalledTimes cannot express "the token URL was requested once".
      expect(
        networkService.get.mock.calls.filter(
          ([{ url }]) => url === tokenUrl(chain, token.address),
        ),
      ).toHaveLength(1);
    });

    it('returns an empty list when no address is known', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const unknown = getAddress(faker.finance.ethereumAddress());
      mockUpstream(chain, [], [unknown]);

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({ addresses: unknown })
        .expect(200)
        .expect([]);
    });

    it('returns 422 when addresses is missing or empty', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .expect(422);
      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({ addresses: '' })
        .expect(422);
    });

    it(`returns 422 for more than ${MAX_TOKEN_ADDRESSES} addresses`, async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const addresses = Array.from({ length: MAX_TOKEN_ADDRESSES + 1 }, () =>
        getAddress(faker.finance.ethereumAddress()),
      );

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({ addresses: addresses.join(',') })
        .expect(422);
      expect(networkService.get).not.toHaveBeenCalled();
    });

    it('returns 422 when one address is malformed', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const address = getAddress(faker.finance.ethereumAddress());

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({ addresses: `${address},0xnot-an-address` })
        .expect(422);
    });

    it('propagates a Transaction Service failure that is not a 404', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const token = erc20TokenBuilder().build();
      const failing = getAddress(faker.finance.ethereumAddress());
      networkService.get.mockImplementation(({ url }) => {
        if (url === `${safeConfigUrl}/api/v1/chains/${chain.chainId}`) {
          return Promise.resolve({ data: rawify(chain), status: 200 });
        }
        if (url === tokenUrl(chain, token.address)) {
          return Promise.resolve({ data: rawify(token), status: 200 });
        }
        if (url === tokenUrl(chain, failing)) {
          return Promise.reject(
            new NetworkResponseError(new URL(url), { status: 503 } as Response),
          );
        }
        return Promise.reject(
          new NetworkResponseError(new URL(url), { status: 418 } as Response),
        );
      });

      await request(app.getHttpServer())
        .get(`/v1/chains/${chain.chainId}/tokens`)
        .query({ addresses: `${token.address},${failing}` })
        .expect(503);
    });
  });

  describe('rate limiting', () => {
    let limitedApp: INestApplication<Server>;

    beforeAll(async () => {
      const defaultConfiguration = configuration();
      const testConfiguration = (): typeof defaultConfiguration => ({
        ...defaultConfiguration,
        tokens: { rateLimit: { max: 1, windowSeconds: 60 } },
      });
      const moduleFixture = await createTestModule({
        config: testConfiguration,
      });

      limitedApp = await new TestAppProvider().provide(moduleFixture);
      await initTestApplication(limitedApp);
    });

    afterAll(async () => {
      await limitedApp?.close();
    });

    it('bounds one caller to the configured number of requests', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const url = `/v1/chains/${chain.chainId}/tokens`;

      // Guards run before pipes, so even a request the ValidationPipe rejects
      // spends the caller's budget — which is the point of the bound.
      await request(limitedApp.getHttpServer())
        .get(url)
        .query({ addresses: '0xnope' })
        .expect(422);

      await request(limitedApp.getHttpServer())
        .get(url)
        .query({ addresses: '0xnope' })
        .expect(429);
    });

    it('bounds the single-token route as well', async () => {
      const chain = chainBuilder().with('chainId', uniqueChainId()).build();
      const url = `/v1/chains/${chain.chainId}/tokens/0xnope`;

      await request(limitedApp.getHttpServer()).get(url).expect(422);
      await request(limitedApp.getHttpServer()).get(url).expect(429);
    });
  });
});
