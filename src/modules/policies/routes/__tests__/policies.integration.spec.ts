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
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import type { Delegate } from '@/modules/delegate/domain/entities/delegate.entity';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import {
  rawIndexerMetaBuilder,
  rawPolicyIndexerResponse,
} from '@/modules/policies/domain/entities/indexer/__tests__/policy-indexer-state.builder';
import type {
  RawIndexerSafeAllowance,
  RawIndexerSafeDelegate,
} from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import {
  rawIndexerSafeAllowanceBuilder,
  rawIndexerSafeDelegateBuilder,
} from '@/modules/policies/domain/entities/indexer/__tests__/safe-allowance.builder';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '@/validation/entities/raw.entity';

const SEPOLIA_CHAIN_ID = '11155111';
const DAY_IN_MINUTES = 1440;
const MILLISECONDS_IN_MINUTE = 60_000;
const POLYGON_CHAIN_ID = '137';

describe('Space Policies Controller', () => {
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
    const walletResponse = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    const accessToken = jwtService.sign(
      siweAuthPayloadDtoBuilder()
        .with('sub', String(walletResponse.body.id))
        .build(),
    );

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

  /**
   * The chains, the Safes with the allowance module enabled, and the delegate
   * registrations the Transaction Service holds for them.
   */
  function mockUpstream(
    args: {
      modules?: Array<`0x${string}`>;
      delegates?: Array<Delegate>;
      delegatesUnavailable?: boolean;
    } = {},
  ): void {
    const modules = args.modules ?? [allowanceModule];
    const delegates = args.delegates ?? [];
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
      // The proposer half. Both delegates APIs land here while the Queue
      // Service is switched off, which is what the test configuration sets.
      if (url.endsWith('/api/v2/delegates/')) {
        if (args.delegatesUnavailable) {
          return Promise.reject(new Error('Service unavailable'));
        }
        return Promise.resolve({
          data: rawify(
            pageBuilder<Delegate>().with('results', delegates).build(),
          ),
          status: 200,
        });
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

  function anOpenWindowStart(): number {
    return Math.floor(Date.now() / MILLISECONDS_IN_MINUTE) - 1;
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
      .with('resetTimeMinutes', String(DAY_IN_MINUTES))
      .with('resetPhase', 'EXACT');
  }

  /**
   * The registrations that let the spenders of {@link allowances} spend now.
   *
   * The allowance row no longer carries the flag, so a state with allowances and
   * no delegates reports every spender as inactive.
   */
  function registrationsFor(
    allowances: ReadonlyArray<RawIndexerSafeAllowance>,
  ): Array<RawIndexerSafeDelegate> {
    return allowances.map((allowance) =>
      rawIndexerSafeDelegateBuilder()
        .with('chainId', allowance.chainId)
        .with('safe', allowance.safe)
        .with('module', allowance.module)
        .with('delegate', allowance.delegate)
        .with('active', true)
        .build(),
    );
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
    const policyTypes = Object.values(PolicyType).join(',');

    it('should return the policies of every safe in the space, in one indexer read', async () => {
      const sepolia = anAllowance().build();
      const polygon = anAllowance()
        .with('chainId', Number(POLYGON_CHAIN_ID))
        .with('safe', polygonSafeAddress)
        .with('moduleVersion', '0.1.1')
        .build();
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerResponse({
          _meta: [
            rawIndexerMetaBuilder()
              .with('chainId', Number(SEPOLIA_CHAIN_ID))
              .build(),
            rawIndexerMetaBuilder()
              .with('chainId', Number(POLYGON_CHAIN_ID))
              .build(),
          ],
          SafeAllowance: [sepolia, polygon],
          SafeDelegate: registrationsFor([sepolia, polygon]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
        withSafeOnPolygon: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const policies = body as Array<{
        safe: { chainId: string; address: string };
      }>;
      expect(policies.map((item) => item.safe)).toStrictEqual([
        { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
        { chainId: POLYGON_CHAIN_ID, address: polygonSafeAddress },
      ]);
      // one read for both Safes, on both chains
      expect(networkService.post).toHaveBeenCalledTimes(1);
    });

    it('should narrow the read to the requested safes', async () => {
      mockUpstream();
      const allowance = anAllowance().build();
      mockIndexer(
        rawPolicyIndexerResponse({
          SafeAllowance: [allowance],
          SafeDelegate: registrationsFor([allowance]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
        withSafeOnPolygon: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({
          types: policyTypes,
          safes: `${SEPOLIA_CHAIN_ID}:${safeAddress}`,
        })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toHaveLength(1);
    });

    it('should reject a safe outside the space', async () => {
      mockUpstream();
      mockIndexer(rawPolicyIndexerResponse());
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({
          types: policyTypes,
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
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect([]);
    });

    it('should return the spending limit of a safe in the space', async () => {
      const windowStart = anOpenWindowStart();
      const allowance = anAllowance()
        .with('lastResetMin', String(windowStart))
        .build();
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerResponse({
          SafeAllowance: [allowance],
          SafeDelegate: registrationsFor([allowance]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toStrictEqual([
        {
          type: PolicyType.SpendingLimit,
          enforcement: { via: 'module', moduleAddress: allowanceModule },
          enabled: true,
          safe: { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
          data: {
            module: allowanceModule,
            spenders: [
              {
                spender: getAddress(allowance.delegate),
                isActive: true,
                allowances: [
                  {
                    tokenAddress: getAddress(allowance.token),
                    amount: '1000',
                    spent: '250',
                    resetPeriodMinutes: DAY_IN_MINUTES,
                    resetsAtMinute: windowStart + DAY_IN_MINUTES,
                    resetBoundaryIsExact: true,
                    isDelegateActive: true,
                  },
                ],
              },
            ],
          },
        },
      ]);
    });

    it('should report the proposers of a safe, once per delegates api', async () => {
      // Both APIs read the same upstream while the Queue Service is off, so the
      // same grant is reported once per version rather than merged - a client
      // revokes a grant through the API holding it.
      const proposer = delegateBuilder().with('safe', safeAddress).build();
      mockUpstream({ delegates: [proposer] });
      mockIndexer(rawPolicyIndexerResponse({}));
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const enforcement = { via: 'offchain', source: 'delegates' };
      const proposers = [
        {
          proposer: proposer.delegate,
          delegatedBy: [
            { delegator: proposer.delegator, label: proposer.label },
          ],
        },
      ];
      expect(body).toStrictEqual([
        {
          type: PolicyType.Proposer,
          enforcement,
          enabled: true,
          safe: { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
          data: { version: 'v2', proposers },
        },
        {
          type: PolicyType.Proposer,
          enforcement,
          enabled: true,
          safe: { chainId: SEPOLIA_CHAIN_ID, address: safeAddress },
          data: { version: 'v3', proposers },
        },
      ]);
    });

    it('should report no proposer policy for a safe with no delegates', async () => {
      mockUpstream({ delegates: [] });
      mockIndexer(rawPolicyIndexerResponse({}));
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect([]);
    });

    it('should fail when the delegates api is unavailable', async () => {
      // Atomic, like the rest of the page: a Safe whose proposers could not be
      // read must not report as having none.
      mockUpstream({ delegatesUnavailable: true });
      mockIndexer(rawPolicyIndexerResponse({}));
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(503);
    });

    it('should report a reset ahead of now', async () => {
      const windowStart = anOpenWindowStart();
      const allowance = anAllowance()
        .with('lastResetMin', String(windowStart - 30 * DAY_IN_MINUTES))
        .build();
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerResponse({
          SafeAllowance: [allowance],
          SafeDelegate: registrationsFor([allowance]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body[0].data.spenders[0].allowances[0].resetsAtMinute).toBe(
        windowStart + DAY_IN_MINUTES,
      );
    });

    it('should report a limit as unenforced when the module is not enabled', async () => {
      mockUpstream({ modules: [] });
      const allowance = anAllowance().build();
      mockIndexer(
        rawPolicyIndexerResponse({
          SafeAllowance: [allowance],
          SafeDelegate: registrationsFor([allowance]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toMatchObject([{ enabled: false }]);
    });

    it('should return an empty page for a safe with no policies', async () => {
      mockUpstream();
      mockIndexer(
        rawPolicyIndexerResponse({
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
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect([]);
    });

    it('should fail when the indexer is unavailable', async () => {
      mockUpstream();
      networkService.post.mockRejectedValue(new Error('ECONNREFUSED'));
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: policyTypes })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(503);
    });

    it('should return 400 for an invalid space identifier', async () => {
      const { accessToken } = await createSpaceWithSafe({ withSafe: true });

      await request(app.getHttpServer())
        .get('/v1/spaces/not-a-uuid/policies/active')
        .query({ types: policyTypes })
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
        .query({ types: policyTypes, safes: 'not-a-safe' })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it('should narrow the read to the requested policy types', async () => {
      const proposer = delegateBuilder().with('safe', safeAddress).build();
      const allowance = anAllowance().build();
      mockUpstream({ delegates: [proposer] });
      mockIndexer(
        rawPolicyIndexerResponse({
          SafeAllowance: [allowance],
          SafeDelegate: registrationsFor([allowance]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: PolicyType.Proposer })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(
        (body as Array<{ type: string }>).map((policy) => policy.type),
      ).toStrictEqual([PolicyType.Proposer, PolicyType.Proposer]);
      // The indexer feeds spending limits only, so it is never asked.
      expect(networkService.post).not.toHaveBeenCalled();
    });

    it('should report both types when both are requested', async () => {
      const proposer = delegateBuilder().with('safe', safeAddress).build();
      const allowance = anAllowance().build();
      mockUpstream({ delegates: [proposer] });
      mockIndexer(
        rawPolicyIndexerResponse({
          SafeAllowance: [allowance],
          SafeDelegate: registrationsFor([allowance]),
        }),
      );
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({
          types: `${PolicyType.SpendingLimit},${PolicyType.Proposer}`,
        })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(
        new Set((body as Array<{ type: string }>).map((policy) => policy.type)),
      ).toStrictEqual(new Set([PolicyType.SpendingLimit, PolicyType.Proposer]));
    });

    it('should return an empty page for a type nothing reports yet', async () => {
      mockUpstream();
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: PolicyType.Recovery })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect([]);
    });

    it('should return 422 for an unknown policy type', async () => {
      mockUpstream();
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: 'not-a-policy-type' })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it('should return 422 when no policy types are asked for', async () => {
      // There is no unfiltered read: omitting `types` is a malformed request
      // rather than a request for every type.
      mockUpstream();
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });

    it('should return 422 for an empty policy type filter', async () => {
      mockUpstream();
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/policies/active`)
        .query({ types: '' })
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });
  });
});
