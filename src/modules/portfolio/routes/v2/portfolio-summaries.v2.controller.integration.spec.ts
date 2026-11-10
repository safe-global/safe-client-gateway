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

const networks = { ethereum: 1, polygon: 137 } as const;

/** Zerion's chain list keyed by network name, as served by GET /v1/chains. */
const zerionChainsResponse = {
  data: Object.entries(networks).map(([id, chainId]) => ({
    type: 'chain',
    id,
    attributes: { external_id: numberToHex(chainId), name: id, icon: null },
  })),
};

/** A displayable, non-trash wallet row worth {@link value} on {@link network}. */
const zerionRow = (network: string, value: number): ZerionBalance =>
  zerionBalanceBuilder()
    .with(
      'attributes',
      zerionAttributesBuilder()
        .with('value', value)
        .with('position_type', PositionType.wallet)
        .with('flags', { displayable: true, is_trash: false })
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

  // Above the dust threshold of the test configuration.
  const fiat = (): number => faker.number.int({ min: 1_000, max: 100_000 });

  beforeEach(async () => {
    const defaultConfiguration = configuration();
    const moduleFixture = await createTestModule({
      config: () => ({
        ...defaultConfiguration,
        features: { ...defaultConfiguration.features, zerion: true },
      }),
    });
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    zerionBaseUri = configurationService.getOrThrow(
      'balances.providers.zerion.baseUri',
    );
    networkService = moduleFixture.get(NetworkService);
    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app.close();
  });

  /** @returns A spy on the Zerion /positions call */
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

  it('values each chain of a Safe from one cached Zerion /positions call', async () => {
    const address = getAddress(faker.finance.ethereumAddress());
    const chains = Object.values(networks).map((chainId) =>
      chainBuilder()
        .with('chainId', String(chainId))
        .with('isTestnet', false)
        .build(),
    );
    const [onEthereum, onPolygon] = [fiat(), fiat()];
    const getPositions = mockUpstreams({
      chains,
      address,
      rows: [
        zerionRow('ethereum', onEthereum),
        zerionRow('polygon', onPolygon),
      ],
    });
    const query = {
      safes: chains.map(({ chainId }) => `${chainId}:${address}`).join(','),
      currency: 'usd',
    };

    for (let i = 0; i < 2; i++) {
      await request(app.getHttpServer())
        .get('/v2/portfolio/summaries')
        .query(query)
        .expect(200)
        .expect(({ body }) =>
          expect(body).toMatchObject([
            {
              chainId: '1',
              address,
              fiatTotal: getNumberString(onEthereum),
              source: 'zerion',
              snapshot: {
                fiatTotal: getNumberString(onEthereum + onPolygon),
                fiatTotalByChain: {
                  '1': getNumberString(onEthereum),
                  '137': getNumberString(onPolygon),
                },
              },
            },
            {
              chainId: '137',
              address,
              fiatTotal: getNumberString(onPolygon),
              source: 'zerion',
            },
          ]),
        );
    }

    // The second request reads the cached snapshot.
    expect(getPositions).toHaveBeenCalledTimes(1);
  });

  it('rejects a currency code that is not three letters', async () => {
    await request(app.getHttpServer())
      .get('/v2/portfolio/summaries')
      .query({
        safes: `1:${getAddress(faker.finance.ethereumAddress())}`,
        currency: faker.string.numeric(3),
      })
      .expect(422);

    expect(networkService.get).not.toHaveBeenCalled();
  });
});
