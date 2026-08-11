// SPDX-License-Identifier: FSL-1.1-MIT

import type { Server } from 'node:http';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { getAddress, type Hex, zeroAddress } from 'viem';
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
import { policyConfigurationBuilder } from '@/modules/policies/domain/entities/__tests__/policy-configuration.builder';
import {
  hexBuilder,
  policyConfirmationBuilder,
  rawPolicyConfirmation,
  TRANSFER_SELECTOR,
} from '@/modules/policies/domain/entities/__tests__/policy-confirmation.builder';
import { policyRootRequestBuilder } from '@/modules/policies/domain/entities/__tests__/policy-root-request.builder';
import type { PolicyConfiguration } from '@/modules/policies/domain/entities/policy-configuration.entity';
import { PolicyOperation } from '@/modules/policies/domain/entities/policy-confirmation.entity';
import { PolicyRootRequestStatus } from '@/modules/policies/domain/entities/policy-root-request.entity';
import { PolicyType } from '@/modules/policies/domain/entities/policy-type.entity';
import { POLICY_CATALOGUE } from '@/modules/policies/domain/policy-catalogue.constants';
import { accessSelector } from '@/modules/policies/domain/utils/policy-access.utils';
import { configurationRoot } from '@/modules/policies/domain/utils/policy-configuration-root.utils';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '@/validation/entities/raw.entity';

const SEPOLIA_CHAIN_ID = '11155111';
/**
 * The addresses the catalogue reports for Sepolia, pinned through
 * `policies.deployments` below rather than left to the default deployment so the
 * assertions do not depend on the shipped constants.
 *
 * `/policies/active` does not depend on them: it takes the addresses from the
 * Transaction Service's indexed events.
 */
const ERC20_TRANSFER_POLICY = getAddress(faker.finance.ethereumAddress());
const SAFE_POLICY_GUARD = getAddress(faker.finance.ethereumAddress());
const POLICY_ENGINE_DEPLOYMENTS = JSON.stringify({
  [SEPOLIA_CHAIN_ID]: {
    safePolicyGuard: SAFE_POLICY_GUARD,
    policyContracts: { [PolicyType.Erc20Transfer]: ERC20_TRANSFER_POLICY },
  },
});

describe('PoliciesController (e2e)', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;

  const chain = chainBuilder().with('chainId', SEPOLIA_CHAIN_ID).build();
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
      policies: {
        ...defaultConfiguration.policies,
        deployments: POLICY_ENGINE_DEPLOYMENTS,
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
      expect(items).toHaveLength(POLICY_CATALOGUE.length);
      expect(
        items.find((item) => item.type === PolicyType.Erc20Transfer),
      ).toMatchObject({
        available: true,
        isFallback: false,
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
      expect(items.every((item) => item.available)).toBe(true);
      expect(items.some((item) => item.configuredCount !== undefined)).toBe(
        false,
      );
    });

    it('should flag the fallback policies', async () => {
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
      expect(
        items.filter((item) => item.isFallback).map((item) => item.type),
      ).toStrictEqual([
        PolicyType.AllowPolicy,
        PolicyType.NativeTransfer,
        PolicyType.Deny,
      ]);
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
      mockTransactionService({
        confirmations: [rawPolicyConfirmation(confirmation)],
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
                  recipients: [{ address: recipient }],
                },
              ],
            },
          },
        ],
      });
    });

    it('should accumulate the recipients configured over several transactions', async () => {
      // Regression, from a real Safe: the allowlist was built up by three
      // `configure` calls on the same access, each allowing one recipient, next
      // to four grants of the fallback AllowPolicy. Only the last configure call
      // used to be reported, so the response carried one recipient of three.
      const token = getAddress(faker.finance.ethereumAddress());
      const recipients = [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ];
      const allowPolicy = getAddress(faker.finance.ethereumAddress());
      const blocks = [465, 469, 473];

      const transfers = recipients.map((recipient, index) =>
        policyConfirmationBuilder()
          .with('safe', safeAddress)
          .with('guard', getAddress(SAFE_POLICY_GUARD))
          .with('target', token)
          .with('selector', TRANSFER_SELECTOR)
          .with('policy', ERC20_TRANSFER_POLICY)
          .with('policyType', 'ERC20TransferPolicy')
          .with('blockNumber', blocks[index])
          .with('logIndex', 1)
          .with('dataDecoded', {
            policyName: 'ERC20TransferPolicy',
            parameters: { recipients: [{ recipient, allowed: true }] },
          })
          .build(),
      );
      const fallbacks = [443, ...blocks].map((blockNumber) =>
        policyConfirmationBuilder()
          .with('safe', safeAddress)
          .with('guard', getAddress(SAFE_POLICY_GUARD))
          .with('target', zeroAddress)
          .with('selector', '0x00000000')
          .with('fallback', true)
          .with('policy', allowPolicy)
          .with('policyType', 'AllowPolicy')
          .with('blockNumber', blockNumber)
          .with('logIndex', 2)
          .with('data', '0x')
          .with('dataDecoded', null)
          .build(),
      );

      mockTransactionService({
        // newest first, as the Transaction Service returns them
        confirmations: [...transfers, ...fallbacks]
          .sort(
            (first, second) =>
              second.blockNumber - first.blockNumber ||
              second.logIndex - first.logIndex,
          )
          .map(rawPolicyConfirmation),
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

      const items = (body as { items: Array<Record<string, unknown>> }).items;
      const allowlistItem = items.find(
        (item) => item.type === PolicyType.Erc20Transfer,
      );
      expect(allowlistItem).toMatchObject({
        data: {
          allowlist: [
            {
              token: { address: token },
              recipients: recipients.map((address) => ({ address })),
            },
          ],
        },
      });
      // the four fallback grants are one access, so one item
      expect(items).toHaveLength(2);
      expect(
        items.filter((item) => item.type === PolicyType.AllowPolicy),
      ).toHaveLength(1);
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
        confirmations: [rawPolicyConfirmation(confirmation)],
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
            // no configurations stored for this root
            policies: null,
          },
        ],
      });
    });

    it('should report the stored configurations of a pending root', async () => {
      // The full loop: store the configurations, then read them back as the
      // policy bindings of the pending request.
      const configurations = [policyConfigurationBuilder().build()];
      const root = configurationRoot(configurations);
      const rootRequest = policyRootRequestBuilder()
        .with('safe', safeAddress)
        .with('guard', getAddress(SAFE_POLICY_GUARD))
        .with('status', PolicyRootRequestStatus.Pending)
        .with('root', root)
        .build();
      mockTransactionService({ rootRequests: [rootRequest] });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ root, configurations })
        .expect(201);

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/pending`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toMatchObject({
        items: [
          {
            configureRoot: root,
            policies: [
              {
                id: accessSelector({
                  target: configurations[0].target,
                  selector: configurations[0].selector,
                  operation: PolicyOperation.Call,
                }),
                target: configurations[0].target,
                selector: configurations[0].selector,
                operation: PolicyOperation.Call,
                policyContract: configurations[0].policy,
              },
            ],
          },
        ],
      });
    });

    it('should report one entry per configuration of a root', async () => {
      const configurations = [
        policyConfigurationBuilder().build(),
        policyConfigurationBuilder().build(),
        policyConfigurationBuilder().build(),
      ];
      const root = configurationRoot(configurations);
      mockTransactionService({
        rootRequests: [
          policyRootRequestBuilder()
            .with('safe', safeAddress)
            .with('status', PolicyRootRequestStatus.Pending)
            .with('root', root)
            .build(),
        ],
      });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ root, configurations })
        .expect(201);

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/pending`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      const [item] = (body as { items: Array<{ policies: Array<unknown> }> })
        .items;
      expect(item.policies).toHaveLength(3);
      expect(
        (item.policies as Array<{ target: string }>).map(
          (policy) => policy.target,
        ),
      ).toStrictEqual(configurations.map((entry) => entry.target));
    });

    it('should report a removal as a null policy contract', async () => {
      const configurations = [
        policyConfigurationBuilder().with('policy', zeroAddress).build(),
      ];
      const root = configurationRoot(configurations);
      mockTransactionService({
        rootRequests: [
          policyRootRequestBuilder()
            .with('safe', safeAddress)
            .with('status', PolicyRootRequestStatus.Pending)
            .with('root', root)
            .build(),
        ],
      });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ root, configurations })
        .expect(201);

      const { body } = await request(app.getHttpServer())
        .get(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/pending`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .expect(200);

      expect(body).toMatchObject({
        items: [{ policies: [{ policyContract: null }] }],
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

  describe('POST /v1/spaces/:spaceId/safes/:safeId/policies/requests', () => {
    /** A payload whose root is the hash of its configurations. */
    function payload(): {
      root: Hex;
      configurations: Array<PolicyConfiguration>;
    } {
      const configurations = [policyConfigurationBuilder().build()];
      return { root: configurationRoot(configurations), configurations };
    }

    it('should store the configurations of an open root', async () => {
      const body = payload();
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(body)
        .expect(201)
        .expect({ configureRoot: body.root });
    });

    it('should accept the same root twice', async () => {
      const body = payload();
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });
      const url = `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`;

      await request(app.getHttpServer())
        .post(url)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(body)
        .expect(201);

      await request(app.getHttpServer())
        .post(url)
        .set('Cookie', [`access_token=${accessToken}`])
        .send(body)
        .expect(201);
    });

    it('should return 422 when the configurations do not hash to the root', async () => {
      const body = payload();
      const claimedRoot = hexBuilder(32);
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send({ ...body, root: claimedRoot })
        .expect(422);
    });

    it('should store a root that is not on-chain yet', async () => {
      // The wallet stores the configurations first and requests them on-chain
      // afterwards, so an unknown root must be accepted.
      const body = payload();
      mockTransactionService({ rootRequests: [] });
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(body)
        .expect(201)
        .expect({ configureRoot: body.root });
    });

    it.each([
      ['an empty configuration list', { configurations: [] }],
      ['a malformed selector', { selector: '0xa9059c' }],
      ['an unknown operation', { operation: 2 }],
      ['a malformed address', { target: '0x123' }],
    ])('should return 422 for %s', async (_, override) => {
      const body = payload();
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: true,
      });
      const invalid =
        'configurations' in override
          ? { ...body, ...override }
          : {
              ...body,
              configurations: [{ ...body.configurations[0], ...override }],
            };

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(invalid)
        .expect(422);
    });

    it('should return 403 for a user who is not a member of the space', async () => {
      const body = payload();
      mockTransactionService({});
      const { spaceId } = await createSpaceWithSafe({ withSafe: true });
      const outsiderToken = jwtService.sign(
        siweAuthPayloadDtoBuilder().build(),
      );
      await request(app.getHttpServer())
        .post('/v1/users/wallet')
        .set('Cookie', [`access_token=${outsiderToken}`]);

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${outsiderToken}`])
        .send(body)
        .expect(403);
    });

    it('should return 404 for a Safe that is not in the space', async () => {
      const body = payload();
      mockTransactionService({});
      const { accessToken, spaceId } = await createSpaceWithSafe({
        withSafe: false,
      });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .set('Cookie', [`access_token=${accessToken}`])
        .send(body)
        .expect(404);
    });

    it('should return 403 without authentication', async () => {
      const body = payload();
      mockTransactionService({});
      const { spaceId } = await createSpaceWithSafe({ withSafe: true });

      await request(app.getHttpServer())
        .post(
          `/v1/spaces/${spaceId}/safes/${SEPOLIA_CHAIN_ID}:${safeAddress}/policies/requests`,
        )
        .send(body)
        .expect(403);
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
});
