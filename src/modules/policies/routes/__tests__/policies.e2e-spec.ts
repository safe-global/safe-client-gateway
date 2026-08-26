// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:http';
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
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import {
  rawIndexerMetaBuilder,
  rawPolicyIndexerState,
} from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import { rawIndexerSafeAllowanceBuilder } from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '@/validation/entities/raw.entity';

const SEPOLIA_CHAIN_ID = '11155111';
const POLYGON_CHAIN_ID = '137';

describe('Policies routes (e2e)', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;
  let indexerBaseUri: string;

  const chain = chainBuilder().with('chainId', SEPOLIA_CHAIN_ID).build();
  const polygonChain = chainBuilder().with('chainId', POLYGON_CHAIN_ID).build();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const polygonSafeAddress = getAddress(faker.finance.ethereumAddress());
  const allowanceModule = getAddress(faker.finance.ethereumAddress());
  const txServiceUrl = chain.transactionService;

  /**
   * Signs up a user, creates a space and adds `safeAddress` to it.
   *
   * @returns the access token of the space admin and the space UUID
   */
  async function createSpaceWithSafe(args: {
    withSafe: boolean;
    withSafeOnPolygon?: boolean;
  }): Promise<{ accessToken: string; spaceId: string }> {
    const accessToken = jwtService.sign(siweAuthPayloadDtoBuilder().build());

    await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [`access_token=${accessToken}`]);

    const { body } = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() })
      .expect(201);
    const spaceId = (body as { uuid: string }).uuid;

    if (args.withSafe) {
      const safes = [{ chainId: SEPOLIA_CHAIN_ID, address: safeAddress }];
      if (args.withSafeOnPolygon) {
        safes.push({
          chainId: POLYGON_CHAIN_ID,
          address: polygonSafeAddress,
        });
      }
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes })
        .expect(201);
    }

    return { accessToken, spaceId };
  }

  /** The chains, and Safes with the allowance module enabled. */
  function mockUpstream(args: { modules?: Array<`0x${string}`> } = {}): void {
    const modules = args.modules ?? [allowanceModule];
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with('modules', modules)
      .build();
    const polygonSafe = safeBuilder()
      .with('address', polygonSafeAddress)
      .with('modules', modules)
      .build();

    networkService.get.mockImplementation(({ url }) => {
      if (
        url.startsWith(`${safeConfigUrl}/api/v1/chains/${POLYGON_CHAIN_ID}`)
      ) {
        return Promise.resolve({ data: rawify(polygonChain), status: 200 });
      }
      if (
        url.startsWith(`${safeConfigUrl}/api/v2/chains/${POLYGON_CHAIN_ID}`)
      ) {
        return Promise.resolve({ data: rawify(polygonChain), status: 200 });
      }
      if (url.startsWith(`${safeConfigUrl}/api/v1/chains`)) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url.startsWith(`${safeConfigUrl}/api/v2/chains`)) {
        return Promise.resolve({ data: rawify(chain), status: 200 });
      }
      if (url === `${txServiceUrl}/api/v1/safes/${safeAddress}`) {
        return Promise.resolve({ data: rawify(safe), status: 200 });
      }
      if (
        url ===
        `${polygonChain.transactionService}/api/v1/safes/${polygonSafeAddress}`
      ) {
        return Promise.resolve({ data: rawify(polygonSafe), status: 200 });
      }
      return Promise.reject(new Error(`No matching rule for url: ${url}`));
    });
  }

  /** The Policy Indexer's answer for this Safe. */
  function mockIndexer(state: Record<string, Array<unknown>>): void {
    networkService.post.mockImplementation(({ url }) => {
      if (url === `${indexerBaseUri}/v1/graphql`) {
        return Promise.resolve({ data: rawify({ data: state }), status: 200 });
      }
      return Promise.reject(new Error(`No matching rule for url: ${url}`));
    });
  }

  function anAllowance(): ReturnType<typeof rawIndexerSafeAllowanceBuilder> {
    return rawIndexerSafeAllowanceBuilder()
      .with('chainId', Number(SEPOLIA_CHAIN_ID))
      .with('safe', safeAddress)
      .with('module', allowanceModule)
      .with('moduleVersion', '0.1.0')
      .with('amount', '1000')
      .with('spent', '250')
      .with('remaining', '750')
      .with('resetTimeMinutes', '1440')
      .with('nextResetAt', '4000000000')
      .with('resetPhase', 'EXACT');
  }

  beforeEach(async () => {
    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
      },
    });

    const moduleFixture = await createTestModule({
      config: testConfiguration,
      overridePostgresV2: false,
      guards: [
        {
          originalGuard: SpacesCreationRateLimitGuard,
          testGuard: { canActivate: (): true => true },
        },
      ],
      modules: [
        {
          originalModule: NotificationsRepositoryV2Module,
          testModule: TestNotificationsRepositoryV2Module,
        },
      ],
    });

    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    networkService = moduleFixture.get(NetworkService);
    const configurationService = moduleFixture.get<IConfigurationService>(
      IConfigurationService,
    );
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    indexerBaseUri = configurationService.getOrThrow(
      'policies.indexer.baseUri',
    );

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/spaces/:spaceId/policies/active', () => {
    it('should return the policies of every safe in the space, in one indexer read', async () => {
      const sepolia = anAllowance().build();
      const polygon = anAllowance()
        .with('chainId', Number(POLYGON_CHAIN_ID))
        .with('safe', polygonSafeAddress)
        .with('moduleVersion', '0.1.1')
        .build();
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerState({
          _meta: [
            rawIndexerMetaBuilder()
              .with('chainId', Number(SEPOLIA_CHAIN_ID))
              .build(),
            rawIndexerMetaBuilder()
              .with('chainId', Number(POLYGON_CHAIN_ID))
              .build(),
          ],
          SafeAllowance: [sepolia, polygon],
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
        withSafeOnPolygon: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const page = body as {
        count: number;
        results: Array<{ safe: { chainId: string; address: string } }>;
      };
      expect(page.count).toBe(2);
      expect(page.results.map((item) => item.safe)).toStrictEqual([
        { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
        { chainId: POLYGON_CHAIN_ID, address: polygonSafeAddress },
      ]);
      // one read for both Safes, on both chains
      expect(networkService.post).toHaveBeenCalledTimes(1);
    });

    it('should narrow the read to the requested safes', async () => {
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerState({ SafeAllowance: [anAllowance().build()] }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
        withSafeOnPolygon: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ safes: `${SEPOLIA_CHAIN_ID}:${safeAddress}` })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toMatchObject({ count: 1 });
    });

    it('should reject a safe outside the space', async () => {
      mockUpstream();
      mockIndexer(rawPolicyIndexerState());
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({
          safes: `${SEPOLIA_CHAIN_ID}:${getAddress(faker.finance.ethereumAddress())}`,
        })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it('should return an empty page for a space with no safes', async () => {
      mockUpstream();
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: false,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ count: 0, next: null, previous: null, results: [] });
    });

    it('should return the spending limit of a safe in the space', async () => {
      const allowance = anAllowance().build();
      mockUpstream();
      mockIndexer(rawPolicyIndexerState({ SafeAllowance: [allowance] }));
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toStrictEqual({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: expect.any(String),
            type: PolicyType.SpendingLimit,
            enforcement: { via: 'module', moduleAddress: allowanceModule },
            enabled: true,
            safe: { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
            data: {
              module: allowanceModule,
              moduleVersion: '0.1.0',
              spenders: [
                {
                  spender: getAddress(allowance.delegate),
                  isActive: true,
                  allowances: [
                    {
                      token_address: getAddress(allowance.token),
                      amount: '1000',
                      spent: '250',
                      remaining: '750',
                      available: '750',
                      resetPeriodSeconds: 86_400,
                      resetsAt: 4_000_000_000,
                      resetBoundaryIsExact: true,
                      nonce: allowance.nonce,
                    },
                  ],
                },
              ],
            },
          },
        ],
      });
    });

    it('should report a limit as unenforced when the module is not enabled', async () => {
      mockUpstream({ modules: [] });
      mockIndexer(
        rawPolicyIndexerState({ SafeAllowance: [anAllowance().build()] }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toMatchObject({ results: [{ enabled: false }] });
    });

    it('should return an empty page for a safe with no policies', async () => {
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerState({
          _meta: [
            rawIndexerMetaBuilder()
              .with('chainId', Number(SEPOLIA_CHAIN_ID))
              .build(),
          ],
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ count: 0, next: null, previous: null, results: [] });
    });

    it('should fail when the indexer is unavailable', async () => {
      mockUpstream();
      networkService.post.mockRejectedValue(new Error('ECONNREFUSED'));
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(503);
    });

    it('should return 400 for an invalid space identifier', async () => {
      const { accessToken } = await createSpaceWithSafe({ withSafe: true });

      await request(app.getHttpServer())
        .get('/v1/spaces/not-a-uuid/policies/active')
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
    });

    it('should return 403 without authentication', async () => {
      const { spaceId } = await createSpaceWithSafe({ withSafe: true });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .expect(403);
    });

    it('should return 422 for a malformed safes filter', async () => {
      mockUpstream();
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ safes: 'not-a-safe' })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });
  });
});
