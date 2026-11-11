// SPDX-License-Identifier: FSL-1.1-MIT
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { type Address, getAddress, numberToHex } from 'viem';
import type { Mock, MockedObject } from 'vitest';
import {
  initTestApplication,
  TestAppProvider,
} from '#/__tests__/test-app.provider';
import { createTestModule } from '#/__tests__/testing-module';
import { IConfigurationService } from '#/config/configuration.service.interface';
import configuration from '#/config/entities/__tests__/configuration';
import type { INetworkService } from '#/datasources/network/network.service.interface';
import { NetworkService } from '#/datasources/network/network.service.interface';
import { getNumberString } from '#/domain/common/utils/utils';
import {
  zerionAttributesBuilder,
  zerionBalanceBuilder,
  zerionFungibleInfoBuilder,
  zerionImplementationBuilder,
} from '#/modules/balances/datasources/entities/__tests__/zerion-balance.entity.builder';
import type { ZerionBalance } from '#/modules/balances/datasources/entities/zerion-balance.entity';
import { chainBuilder } from '#/modules/chains/domain/entities/__tests__/chain.builder';
import type { Chain } from '#/modules/chains/domain/entities/chain.entity';
import { PositionType } from '#/modules/positions/domain/entities/position-type.entity';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import { rawify } from '#/validation/entities/raw.entity';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const [firstNetwork, secondNetwork] = faker.helpers.uniqueArray(
  () => faker.string.alpha({ length: 12, casing: 'lower' }),
  2,
);
const [firstChainId, secondChainId] = faker.helpers.uniqueArray(
  () => faker.number.int({ min: 1, max: 1_000_000 }),
  2,
);
const networks = {
  [firstNetwork]: firstChainId,
  [secondNetwork]: secondChainId,
};

/** Zerion's chain list keyed by network name, as served by GET /v1/chains. */
const zerionChainsResponse = {
  data: Object.entries(networks).map(([id, chainId]) => ({
    type: 'chain',
    id,
    attributes: { external_id: numberToHex(chainId), name: id, icon: null },
  })),
};

const zerionRow = (
  network: string,
  value: number,
  isTrash = false,
): ZerionBalance =>
  zerionBalanceBuilder()
    .with(
      'attributes',
      zerionAttributesBuilder()
        .with('value', value)
        .with('position_type', PositionType.wallet)
        .with('flags', { displayable: true, is_trash: isTrash })
        .with(
          'fungible_info',
          zerionFungibleInfoBuilder()
            .with('implementations', [
              zerionImplementationBuilder().with('chain_id', network).build(),
            ])
            .build(),
        )
        .build(),
    )
    .with('relationships', { chain: { data: { type: 'chains', id: network } } })
    .build();

describe('PortfolioSummariesV2Controller', () => {
  let app: INestApplication<Server>;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;
  let zerionBaseUri: string;
  let currencies: Array<string>;
  let ttlSeconds: number;
  const rateLimitMax = faker.number.int({ min: 3, max: 5 });

  // Above the dust threshold of the test configuration.
  const fiat = (): number => faker.number.int({ min: 1_000, max: 100_000 });

  beforeEach(async () => {
    const defaultConfiguration = configuration();
    const moduleFixture = await createTestModule({
      config: () => ({
        ...defaultConfiguration,
        features: { ...defaultConfiguration.features, zerion: true },
        mappings: {
          ...defaultConfiguration.mappings,
          safe: { ...defaultConfiguration.mappings.safe, maxOverviews: 10 },
        },
        portfolio: {
          ...defaultConfiguration.portfolio,
          summaries: {
            rateLimit: {
              max: rateLimitMax,
              windowSeconds: faker.number.int({ min: 60, max: 120 }),
            },
          },
        },
      }),
    });
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    zerionBaseUri = configurationService.getOrThrow(
      'balances.providers.zerion.baseUri',
    );
    currencies = configurationService.getOrThrow(
      'balances.providers.zerion.currencies',
    );
    ttlSeconds = configurationService.getOrThrow('portfolio.cache.ttlSeconds');
    networkService = moduleFixture.get(NetworkService);
    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app.close();
  });

  const mockUpstreams = (args: {
    chains: Array<Chain>;
    address: Address;
    rows: Array<ZerionBalance>;
  }): Mock<() => void> => {
    const getPositions = vi.fn<() => void>();
    networkService.get.mockImplementation(({ url }) => {
      const chain = args.chains.find(
        ({ chainId, transactionService }) =>
          url === `${safeConfigUrl}/api/v1/chains/${chainId}` ||
          url === `${transactionService}/api/v1/safes/${args.address}`,
      );
      if (chain && url.startsWith(safeConfigUrl)) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (chain) {
        const safe = safeBuilder().with('address', args.address).build();
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (url === `${zerionBaseUri}/v1/chains`) {
        return Promise.resolve({
          data: rawify(zerionChainsResponse),
          status: 200,
        });
      }
      if (url === `${zerionBaseUri}/v1/wallets/${args.address}/positions/`) {
        getPositions();
        return Promise.resolve({
          data: rawify({ data: args.rows }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`No matching rule for url: ${url}`));
    });
    return getPositions;
  };

  it('values each chain of a Safe from one cached, trusted Zerion /positions call', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const chains = Object.values(networks).map((chainId) =>
      chainBuilder()
        .with('chainId', String(chainId))
        .with('isTestnet', false)
        .build(),
    );
    const [onFirst, onSecond] = [fiat(), fiat()];
    const getPositions = mockUpstreams({
      chains,
      address,
      rows: [
        zerionRow(firstNetwork, onFirst),
        zerionRow(secondNetwork, onSecond),
      ],
    });
    const query = {
      safes: chains.map(({ chainId }) => `${chainId}:${address}`).join(','),
      currency: faker.helpers.arrayElement(currencies).toLowerCase(),
    };

    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .get('/v2/portfolio/summaries')
        .query(query)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              chainId: String(firstChainId),
              address,
              fiatTotal: getNumberString(onFirst),
              source: 'zerion',
              snapshot: {
                fiatTotal: getNumberString(onFirst + onSecond),
                fiatTotalByChain: {
                  [firstChainId]: getNumberString(onFirst),
                  [secondChainId]: getNumberString(onSecond),
                },
                fiatTotalByType: {
                  wallet: getNumberString(onFirst + onSecond),
                },
                updatedAt: expect.stringMatching(ISO_DATE),
                expiresAt: expect.stringMatching(ISO_DATE),
              },
            },
            {
              chainId: String(secondChainId),
              address,
              fiatTotal: getNumberString(onSecond),
              source: 'zerion',
            },
          ]),
        )
        .expect(({ body: [{ snapshot }] }) =>
          expect(
            Date.parse(snapshot.expiresAt) - Date.parse(snapshot.updatedAt),
          ).toBe(ttlSeconds * 1_000),
        );
    }

    expect(getPositions).toHaveBeenCalledTimes(1);
    expect(networkService.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${zerionBaseUri}/v1/wallets/${address}/positions/`,
        networkRequest: expect.objectContaining({
          params: expect.objectContaining({
            'filter[trash]': 'only_non_trash',
          }),
        }),
      }),
    );
  });

  it('counts untrusted tokens when trusted=false', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const chain = chainBuilder()
      .with('chainId', String(firstChainId))
      .with('isTestnet', false)
      .build();
    const [trustedValue, untrustedValue] = [fiat(), fiat()];
    mockUpstreams({
      chains: [chain],
      address,
      rows: [
        zerionRow(firstNetwork, trustedValue),
        zerionRow(firstNetwork, untrustedValue, true),
      ],
    });

    await request(app.getHttpServer())
      .get('/v2/portfolio/summaries')
      .query({
        safes: `${chain.chainId}:${address}`,
        currency: faker.helpers.arrayElement(currencies),
        trusted: 'false',
      })
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject([
          { fiatTotal: getNumberString(trustedValue + untrustedValue) },
        ]),
      );

    expect(networkService.get).toHaveBeenCalledWith(
      expect.objectContaining({
        url: `${zerionBaseUri}/v1/wallets/${address}/positions/`,
        networkRequest: expect.objectContaining({
          params: expect.not.objectContaining({
            'filter[trash]': expect.anything(),
          }),
        }),
      }),
    );
  });

  it('rejects a trusted value that is not a boolean', async () => {
    await request(app.getHttpServer())
      .get('/v2/portfolio/summaries')
      .query({
        safes: `${firstChainId}:${getAddress(faker.finance.ethereumAddress())}`,
        currency: faker.helpers.arrayElement(currencies),
        trusted: faker.string.alpha(5),
      })
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('rejects a currency code that is not three letters', async () => {
    await request(app.getHttpServer())
      .get('/v2/portfolio/summaries')
      .query({
        safes: `${firstChainId}:${getAddress(faker.finance.ethereumAddress())}`,
        currency: faker.string.numeric(3),
      })
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });

  it('rejects requests over the per-client rate limit', async () => {
    const query = {
      safes: `${firstChainId}:${getAddress(faker.finance.ethereumAddress())}`,
      currency: faker.string.numeric(3),
    };
    for (let i = 0; i < rateLimitMax; i++) {
      await request(app.getHttpServer())
        .get('/v2/portfolio/summaries')
        .query(query)
        .expect(422);
    }

    await request(app.getHttpServer())
      .get('/v2/portfolio/summaries')
      .query(query)
      .expect(429);
  });
});
