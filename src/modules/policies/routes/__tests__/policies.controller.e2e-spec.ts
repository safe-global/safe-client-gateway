// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { TestAppProvider } from '@/__tests__/test-app.provider';
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
import { policyConfirmationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyRootRequestBuilder } from '@/modules/policies/domain/entities/__tests__/policy-root-request.builder';
import { PolicyRootRequestStatus } from '@/modules/policies/domain/entities/policy-root-request.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { FF_POLICIES } from '@/modules/policies/domain/policy-catalogue.constants';
import { POLICY_DEPLOYMENTS } from '@/modules/policies/domain/policy-deployments.constants';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '@/validation/entities/raw.entity';

const SEPOLIA_CHAIN_ID = '11155111';
const ERC20_TRANSFER_POLICY =
  POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].policyContracts[
    PolicyType.Erc20Transfer
  ]!;
const SAFE_POLICY_GUARD = POLICY_DEPLOYMENTS[SEPOLIA_CHAIN_ID].safePolicyGuard;

describe('PoliciesController (e2e)', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;

  const chain = chainBuilder()
    .with('chainId', SEPOLIA_CHAIN_ID)
    .with('features', [FF_POLICIES])
    .build();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const txServiceUrl = chain.transactionService;

  /**
   * Signs up a user, creates a space and adds `safeAddress` to it.
   *
   * @returns the access token of the space admin and the space UUID
   */
  async function createSpaceWithSafe(args: {
    withSafe: boolean;
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
      await request(app.getHttpServer())
        .post(`/v1/spaces/${spaceId}/safes`)
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ safes: [{ chainId: SEPOLIA_CHAIN_ID, address: safeAddress }] })
        .expect(201);
    }

    return { accessToken, spaceId };
  }

  function mockTransactionService(args: {
    confirmations?: Array<unknown>;
    rootRequests?: Array<unknown>;
    guard?: string;
  }): void {
    const safe = safeBuilder()
      .with('address', safeAddress)
      .with('guard', getAddress(args.guard ?? SAFE_POLICY_GUARD))
      .build();

    networkService.get.mockImplementation(({ url }) => {
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
        `${txServiceUrl}/api/v2/safes/${safeAddress}/policy-confirmations/`
      ) {
        return Promise.resolve({
          data: rawify({
            count: args.confirmations?.length ?? 0,
            next: null,
            previous: null,
            results: args.confirmations ?? [],
          }),
          status: 200,
        });
      }
      if (
        url ===
        `${txServiceUrl}/api/v2/safes/${safeAddress}/policy-root-requests/`
      ) {
        return Promise.resolve({
          data: rawify({
            count: args.rootRequests?.length ?? 0,
            next: null,
            previous: null,
            results: args.rootRequests ?? [],
          }),
          status: 200,
        });
      }
      return Promise.reject(new Error(`No matching rule for url: ${url}`));
    });
  }

  beforeEach(async () => {
    vi.resetAllMocks();

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
    safeConfigUrl = moduleFixture
      .get<IConfigurationService>(IConfigurationService)
      .getOrThrow('safeConfig.baseUri');

    app = await new TestAppProvider().provide(moduleFixture);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /v1/spaces/:spaceId/safes/:safeId/policies', () => {
    it('should return the catalogue with the deployment addresses inline', async () => {
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const items = (body as { items: Array<Record<string, unknown>> }).items;
      expect(items).toHaveLength(4);
      expect(
        items.find((item) => item.type === PolicyType.Erc20Transfer),
      ).toMatchObject({
        available: true,
        configuredCount: 0,
        enforcement: {
          via: 'guard',
          guards: {
            transactionGuard: {
              policyContract: ERC20_TRANSFER_POLICY,
              safePolicyGuard: SAFE_POLICY_GUARD,
            },
          },
        },
      });
    });

    it('should count the active policies of the Safe', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('safe', safeAddress)
        .with('guard', getAddress(SAFE_POLICY_GUARD))
        .with('policy', ERC20_TRANSFER_POLICY)
        .with('dataDecoded', {
          policyName: 'ERC20TransferPolicy',
          parameters: {
            recipients: [
              {
                recipient: getAddress(faker.finance.ethereumAddress()),
                allowed: true,
              },
            ],
          },
        })
        .build();
      mockTransactionService({ confirmations: [confirmation] });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const items = (body as { items: Array<Record<string, unknown>> }).items;
      expect(
        items.find((item) => item.type === PolicyType.Erc20Transfer)
          ?.configuredCount,
      ).toBe(1);
    });
  });

  describe('GET /v1/spaces/:spaceId/safes/:safeId/policies/active', () => {
    it('should return the token withdraw allowlist', async () => {
      const recipient = getAddress(faker.finance.ethereumAddress());
      const confirmation = policyConfirmationBuilder()
        .with('safe', safeAddress)
        .with('guard', getAddress(SAFE_POLICY_GUARD))
        .with('policy', ERC20_TRANSFER_POLICY)
        .with('dataDecoded', {
          policyName: 'ERC20TransferPolicy',
          parameters: { recipients: [{ recipient, allowed: true }] },
        })
        .build();
      mockTransactionService({ confirmations: [confirmation] });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/active`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toMatchObject({
        items: [
          {
            type: PolicyType.Erc20Transfer,
            enabled: true,
            enforcement: {
              via: 'guard',
              guards: {
                transactionGuard: {
                  policyContract: ERC20_TRANSFER_POLICY,
                  safePolicyGuard: getAddress(SAFE_POLICY_GUARD),
                },
              },
            },
            data: {
              allowlist: [
                {
                  token: { address: confirmation.target },
                  recipients: [{ address: recipient, name: null }],
                },
              ],
            },
          },
        ],
      });
    });

    it('should report a policy as disabled when the guard is not set on the Safe', async () => {
      const confirmation = policyConfirmationBuilder()
        .with('safe', safeAddress)
        .with('guard', getAddress(SAFE_POLICY_GUARD))
        .with('policy', ERC20_TRANSFER_POLICY)
        .with('dataDecoded', {
          policyName: 'ERC20TransferPolicy',
          parameters: {
            recipients: [
              {
                recipient: getAddress(faker.finance.ethereumAddress()),
                allowed: true,
              },
            ],
          },
        })
        .build();
      mockTransactionService({
        confirmations: [confirmation],
        guard: getAddress(faker.finance.ethereumAddress()),
      });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/active`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(
        (body as { items: Array<{ enabled: boolean }> }).items[0].enabled,
      ).toBe(false);
    });

    it('should return an empty list for a Safe without policies', async () => {
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/active`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ items: [] });
    });
  });

  describe('GET /v1/spaces/:spaceId/safes/:safeId/policies/pending', () => {
    it('should return the open root requests', async () => {
      const rootRequest = policyRootRequestBuilder()
        .with('safe', safeAddress)
        .with('guard', getAddress(SAFE_POLICY_GUARD))
        .with('status', PolicyRootRequestStatus.Pending)
        .with('timestamp', new Date('2026-07-27T10:00:00Z'))
        .with('validFrom', new Date('2036-07-27T11:00:00Z'))
        .build();
      mockTransactionService({ rootRequests: [rootRequest] });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/pending`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toStrictEqual({
        items: [
          {
            configureRoot: rootRequest.root,
            requestedAt: new Date('2026-07-27T10:00:00Z').getTime() / 1000,
            readyAt: new Date('2036-07-27T11:00:00Z').getTime() / 1000,
            isReady: false,
            policy: null,
          },
        ],
      });
    });

    it('should exclude invalidated requests', async () => {
      const rootRequest = policyRootRequestBuilder()
        .with('safe', safeAddress)
        .with('status', PolicyRootRequestStatus.Invalidated)
        .build();
      mockTransactionService({ rootRequests: [rootRequest] });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/pending`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200)
        .expect({ items: [] });
    });
  });

  describe('access control', () => {
    it.each([
      ['policies'],
      ['policies/active'],
      ['policies/pending'],
    ])('should return 403 on %s without authentication', async (path) => {
      mockTransactionService({});
      const { spaceId } = await createSpaceWithSafe({ withSafe: true });

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/${path}`,
        )
        .expect(403);
    });

    it('should return 403 for a user who is not a member of the space', async () => {
      mockTransactionService({});
      const { spaceId } = await createSpaceWithSafe({ withSafe: true });
      const outsiderToken = jwtService.sign(
        siweAuthPayloadDtoBuilder().build(),
      );
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${outsiderToken}`]);

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/active`,
        )
        .set('Cookie', [`access_token=${outsiderToken}`])
        .expect(403);
    });

    it('should return 404 for a Safe that is not in the space', async () => {
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: false,
      });

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/active`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(404);
    });

    it('should return 400 for a malformed space identifier', async () => {
      mockTransactionService({});
      const { accessToken } = await createSpaceWithSafe({ withSafe: true });

      await request(app.getHttpServer())
        .get(
          `/v1/spaces/not-a-uuid/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(400);
    });

    it.each([
      ['without a chain id', () => safeAddress],
      ['with an invalid address', () => `${SEPOLIA_CHAIN_ID}:0x123`],
      ['with a non numeric chain id', () => `sepolia:${safeAddress}`],
    ])('should return 422 for a Safe identifier %s', async (_, safeId) => {
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .get(`/v1/spaces/${spaceId}/safes/${safeId()}/policies`)
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(422);
    });
  });

  describe('chain support', () => {
    it('should report the policies as unavailable when the chain feature is off', async () => {
      const chainWithoutPolicies = chainBuilder()
        .with('chainId', SEPOLIA_CHAIN_ID)
        .with('features', [])
        .build();
      const safe = safeBuilder()
        .with('address', safeAddress)
        .with('guard', getAddress(SAFE_POLICY_GUARD))
        .build();
      networkService.get.mockImplementation(({ url }) => {
        if (url.startsWith(`${safeConfigUrl}/api/v1/chains`)) {
          return Promise.resolve({
            data: rawify(chainWithoutPolicies),
            status: 200,
          });
        }
        if (url.startsWith(`${safeConfigUrl}/api/v2/chains`)) {
          return Promise.resolve({
            data: rawify(chainWithoutPolicies),
            status: 200,
          });
        }
        if (
          url ===
          `${chainWithoutPolicies.transactionService}/api/v1/safes/${safeAddress}`
        ) {
          return Promise.resolve({ data: rawify(safe), status: 200 });
        }
        return Promise.resolve({
          data: rawify({ count: 0, next: null, previous: null, results: [] }),
          status: 200,
        });
      });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const items = (body as { items: Array<{ available: boolean }> }).items;
      expect(items.every((item) => !item.available)).toBe(true);
    });
  });
});
