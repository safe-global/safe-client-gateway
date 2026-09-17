// SPDX-License-Identifier: FSL-1.1-MIT

import { randomUUID } from 'node:crypto';
import type { Server } from 'node:net';
import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import type postgres from 'postgres';
import request from 'supertest';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { TestDbFactory } from '@/__tests__/db.factory';
import {
  initTestApplication,
  TestAppProvider,
} from '@/__tests__/test-app.provider';
import { createTestModule } from '@/__tests__/testing-module';
import { checkGuardIsApplied } from '@/__tests__/util/check-guard';
import { IConfigurationService } from '@/config/configuration.service.interface';
import configuration from '@/config/entities/__tests__/configuration';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { IJwtService } from '@/datasources/jwt/jwt.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { NetworkService } from '@/datasources/network/network.service.interface';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { getSignerFactoryDeployments } from '@/domain/common/utils/deployments';
import { execTransactionFromModuleEncoder } from '@/modules/alerts/domain/contracts/__tests__/encoders/delay-modifier-encoder.builder';
import { siweAuthPayloadDtoBuilder } from '@/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '@/modules/auth/routes/guards/auth.guard';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { relayerBuilder } from '@/modules/chains/domain/entities/__tests__/relayer.builder';
import {
  addOwnerWithThresholdEncoder,
  execTransactionEncoder,
} from '@/modules/contracts/domain/__tests__/encoders/safe-encoder.builder';
import { Feature } from '@/modules/entitlements/datasources/entities/feature.entity.db';
import { SpaceFeatureUsage } from '@/modules/entitlements/datasources/entities/space-feature-usage.entity.db';
import { SpaceSubscription } from '@/modules/entitlements/datasources/entities/space-subscription.entity.db';
import { SubscriptionEntitlement } from '@/modules/entitlements/datasources/entities/subscription-entitlement.entity.db';
import { featureBuilder } from '@/modules/entitlements/domain/entities/__tests__/feature.builder';
import { FeatureType } from '@/modules/entitlements/domain/entities/feature.entity';
import { QUOTA_EXCEEDED_ERROR_CODE } from '@/modules/entitlements/domain/errors/quota-exceeded.error';
import { NotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/notifications.repository.module';
import { TestNotificationsRepositoryV2Module } from '@/modules/notifications/domain/v2/test.notification.repository.module';
import { createSignerEncoder } from '@/modules/relay/domain/contracts/__tests__/encoders/signer-factory-encoder.builder';
import { SpaceRelayController } from '@/modules/relay/routes/space-relay.controller';
import { SpacesCreationRateLimitGuard } from '@/modules/spaces/routes/guards/spaces-creation-rate-limit.guard';
import { rawify } from '@/validation/entities/raw.entity';

/** Small enough that a second relay in a test exhausts it. */
const FREE_SPONSORED_TRANSACTIONS = 1;

// Signer factory deployments decide this, not preference: `createSigner` is
// the calldata this suite relays when it wants no Safe to attribute.
const CHAIN_ID = '1';

// No `enforcementStartsAt` override below, on purpose: sponsored transactions
// have no behaviour predating enforcement, so the plan decides whatever the
// date says.
describe('SpaceRelayController', () => {
  let app: INestApplication<Server>;
  let jwtService: IJwtService;
  let postgresDatabaseService: PostgresDatabaseService;
  let networkService: MockedObject<INetworkService>;
  let safeConfigUrl: string;
  let relayUrl: string;

  // Not faker: a fixed FAKER_SEED would hand every spec file the same name.
  const testDatabaseName = `test_${randomUUID().replaceAll('-', '')}`;
  const testDbFactory = new TestDbFactory();
  let testDatabase: postgres.Sql;

  const chain = chainBuilder()
    .with('chainId', CHAIN_ID)
    .with(
      'relayer',
      relayerBuilder()
        .with('enableTenderlySimulationBeforeRelay', false)
        .build(),
    )
    .build();

  beforeAll(async () => {
    vi.resetAllMocks();

    testDatabase = await testDbFactory.createTestDatabase(testDatabaseName);

    const defaultConfiguration = configuration();
    const testConfiguration = (): typeof defaultConfiguration => ({
      ...defaultConfiguration,
      db: {
        ...defaultConfiguration.db,
        connection: {
          ...defaultConfiguration.db.connection,
          postgres: {
            ...defaultConfiguration.db.connection.postgres,
            database: testDatabaseName,
          },
        },
      },
      features: {
        ...defaultConfiguration.features,
        auth: true,
        users: true,
        billingService: true,
      },
      billing: {
        ...defaultConfiguration.billing,
        webhook: {
          ...defaultConfiguration.billing.webhook,
          publicKey: 'dummy-public-key',
        },
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

    const configurationService = moduleFixture.get(IConfigurationService);
    safeConfigUrl = configurationService.getOrThrow('safeConfig.baseUri');
    relayUrl = configurationService.getOrThrow('relay.baseUri');
    jwtService = moduleFixture.get<IJwtService>(IJwtService);
    postgresDatabaseService = moduleFixture.get(PostgresDatabaseService);
    networkService = moduleFixture.get(NetworkService);

    app = await new TestAppProvider().provide(moduleFixture);
    await initTestApplication(app);

    await clearFeatureCatalog();
  });

  async function deleteAll<T extends object>(entity: {
    new (): T;
  }): Promise<void> {
    const repository = await postgresDatabaseService.getRepository(entity);
    await repository.createQueryBuilder().delete().execute();
  }

  async function clearFeatureCatalog(): Promise<void> {
    await deleteAll(SpaceFeatureUsage);
    await deleteAll(SubscriptionEntitlement);
    await deleteAll(SpaceSubscription);
    await deleteAll(Feature);
  }

  beforeEach(async () => {
    const featuresRepository =
      await postgresDatabaseService.getRepository(Feature);
    await featuresRepository.insert([
      featureBuilder()
        .with('key', 'sponsored_transactions')
        .with('type', FeatureType.Metered)
        .with('freeEnabled', true)
        .with('freeQuota', FREE_SPONSORED_TRANSACTIONS)
        .with('freePeriod', 30)
        .build(),
    ]);
  });

  afterEach(async () => {
    await clearFeatureCatalog();
  });

  afterAll(async () => {
    await app?.close();
    await testDbFactory.destroyTestDatabase(testDatabase);
  });

  // Auth resolves the acting user from the JWT `sub`, so a token must carry
  // the id of the DB user it represents.
  const accessTokenForUserId = (userId: number): string =>
    jwtService.sign(
      siweAuthPayloadDtoBuilder().with('sub', userId.toString()).build(),
    );

  const nonMemberToken = (): string =>
    accessTokenForUserId(
      faker.number.int({ min: 69420, max: DB_MAX_SAFE_INTEGER }),
    );

  async function createSpaceForSigner(): Promise<{
    accessToken: string;
    spaceId: string;
  }> {
    const walletResponse = await request(app.getHttpServer())
      .post('/v1/users/wallet')
      .set('Cookie', [
        `access_token=${jwtService.sign(siweAuthPayloadDtoBuilder().build())}`,
      ])
      .expect(201);
    const accessToken = accessTokenForUserId(walletResponse.body.id);
    const createSpaceResponse = await request(app.getHttpServer())
      .post('/v1/spaces')
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ name: nameBuilder() })
      .expect(201);
    return { accessToken, spaceId: createSpaceResponse.body.uuid };
  }

  async function addSafe(args: {
    spaceId: string;
    accessToken: string;
    address: `0x${string}`;
  }): Promise<void> {
    await request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/safes`)
      .set('Cookie', [`access_token=${args.accessToken}`])
      .send({ safes: [{ chainId: CHAIN_ID, address: args.address }] })
      .expect(201);
  }

  /** Calldata recovering `safe`, whose Safe the module lookup resolves. */
  function recoveryOf(safe: `0x${string}`): {
    to: `0x${string}`;
    data: `0x${string}`;
  } {
    const moduleAddress = getAddress(faker.finance.ethereumAddress());
    mockNetwork({ moduleAddress, safes: [safe] });
    return {
      to: moduleAddress,
      data: execTransactionFromModuleEncoder()
        .with('to', safe)
        .with(
          'data',
          execTransactionEncoder()
            .with('data', addOwnerWithThresholdEncoder().encode())
            .encode(),
        )
        .encode(),
    };
  }

  /** Calldata deploying a passkey signer: no Safe to attribute it to. */
  function signerDeployment(): { to: `0x${string}`; data: `0x${string}` } {
    mockNetwork({});
    return {
      to: getAddress(
        faker.helpers.arrayElement(
          getSignerFactoryDeployments({ chainId: CHAIN_ID }),
        ),
      ),
      data: createSignerEncoder().encode(),
    };
  }

  const taskId = (): string => faker.string.uuid();

  function mockNetwork(args: {
    moduleAddress?: `0x${string}`;
    safes?: Array<`0x${string}`>;
    relayTaskId?: string;
  }): void {
    networkService.get.mockImplementation(({ url }) => {
      switch (url) {
        case `${safeConfigUrl}/api/v1/chains/${CHAIN_ID}`:
          return Promise.resolve({ data: rawify(chain), status: 200 });
        case `${chain.transactionService}/api/v1/modules/${args.moduleAddress}/safes/`:
          return Promise.resolve({
            data: rawify({ safes: args.safes ?? [] }),
            status: 200,
          });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });
    networkService.post.mockImplementation(({ url }) => {
      switch (url) {
        case `${relayUrl}/safe-transactions`:
          return Promise.resolve({
            data: rawify({ taskId: args.relayTaskId ?? taskId() }),
            status: 201,
          });
        default:
          return Promise.reject(`No matching rule for url: ${url}`);
      }
    });
  }

  function relay(args: {
    spaceId: string;
    accessToken?: string;
    to: `0x${string}`;
    data: `0x${string}`;
  }): request.Test {
    const call = request(app.getHttpServer())
      .post(`/v1/spaces/${args.spaceId}/chains/${CHAIN_ID}/relay`)
      .send({
        version: '1.3.0',
        to: args.to,
        data: args.data,
      });
    return args.accessToken
      ? call.set('Cookie', [`access_token=${args.accessToken}`])
      : call;
  }

  async function usedOf(args: {
    spaceId: string;
    accessToken: string;
  }): Promise<number> {
    const response = await request(app.getHttpServer())
      .get(`/v1/spaces/${args.spaceId}/entitlements`)
      .set('Cookie', [`access_token=${args.accessToken}`])
      .expect(200);
    return response.body.entitlements.find(
      (entitlement: { feature: string }) =>
        entitlement.feature === 'sponsored_transactions',
    ).used;
  }

  it('should require authentication', () => {
    checkGuardIsApplied(AuthGuard, SpaceRelayController.prototype.relay);
  });

  it('should reject a request with no access token', async () => {
    const { spaceId } = await createSpaceForSigner();

    await relay({ spaceId, ...signerDeployment() }).expect(
      HttpStatus.FORBIDDEN,
    );
  });

  it('should reject a caller who is not a member', async () => {
    const { spaceId } = await createSpaceForSigner();

    await relay({
      spaceId,
      accessToken: nonMemberToken(),
      ...signerDeployment(),
    }).expect(HttpStatus.FORBIDDEN);
  });

  it('should relay a Safe the workspace holds and spend one unit', async () => {
    const { accessToken, spaceId } = await createSpaceForSigner();
    const safe = getAddress(faker.finance.ethereumAddress());
    await addSafe({ spaceId, accessToken, address: safe });
    const id = taskId();
    const { to, data } = recoveryOf(safe);
    mockNetwork({ moduleAddress: to, safes: [safe], relayTaskId: id });

    await relay({ spaceId, accessToken, to, data })
      .expect(201)
      .expect({ taskId: id });

    await expect(usedOf({ spaceId, accessToken })).resolves.toBe(1);
  });

  it('should refuse a Safe the workspace does not hold', async () => {
    const { accessToken, spaceId } = await createSpaceForSigner();
    // Never added to the workspace.
    const { to, data } = recoveryOf(
      getAddress(faker.finance.ethereumAddress()),
    );

    await relay({ spaceId, accessToken, to, data }).expect(
      HttpStatus.FORBIDDEN,
    );

    await expect(usedOf({ spaceId, accessToken })).resolves.toBe(0);
  });

  it('should relay a call with no Safe to attribute', async () => {
    const { accessToken, spaceId } = await createSpaceForSigner();

    await relay({ spaceId, accessToken, ...signerDeployment() }).expect(201);

    await expect(usedOf({ spaceId, accessToken })).resolves.toBe(1);
  });

  it('should ignore a gasLimit a client still sends', async () => {
    const { accessToken, spaceId } = await createSpaceForSigner();
    const { to, data } = signerDeployment();

    // Dropped from the schema rather than rejected, so a client migrating
    // from the chain-scoped route is not broken by a field it used to send.
    await request(app.getHttpServer())
      .post(`/v1/spaces/${spaceId}/chains/${CHAIN_ID}/relay`)
      .set('Cookie', [`access_token=${accessToken}`])
      .send({ version: '1.3.0', to, data, gasLimit: '100000' })
      .expect(201);
  });

  it('should answer 402 once the allowance is spent', async () => {
    const { accessToken, spaceId } = await createSpaceForSigner();
    await relay({ spaceId, accessToken, ...signerDeployment() }).expect(201);

    const response = await relay({
      spaceId,
      accessToken,
      ...signerDeployment(),
    }).expect(HttpStatus.PAYMENT_REQUIRED);

    expect(response.body).toMatchObject({
      code: QUOTA_EXCEEDED_ERROR_CODE,
      feature: 'sponsored_transactions',
      quota: FREE_SPONSORED_TRANSACTIONS,
      used: FREE_SPONSORED_TRANSACTIONS,
    });
    // The refused call spent nothing on top of what was already used.
    await expect(usedOf({ spaceId, accessToken })).resolves.toBe(
      FREE_SPONSORED_TRANSACTIONS,
    );
  });
});
