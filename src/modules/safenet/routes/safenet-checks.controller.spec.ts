// SPDX-License-Identifier: FSL-1.1-MIT
import { getQueueToken } from '@nestjs/bullmq';
import { type ExecutionContext, HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Queue } from 'bullmq';
import request from 'supertest';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import {
  createTestApplication,
  initTestApplication,
  type TestApplication,
} from '#/__tests__/test-app.provider';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { subscriptionPlanBuilder } from '#/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '#/datasources/billing-api/entities/__tests__/subscription.builder';
import type { PlanTypes } from '#/datasources/billing-api/entities/plan.entity';
import type { SubscriptionStatus } from '#/datasources/billing-api/entities/subscription.entity';
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import { SAFENET_CHECKS_QUEUE } from '#/domain/common/jobs.constants';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { IBillingRepository } from '#/modules/billing/domain/billing.repository.interface';
import { IFeatureFlagService } from '#/modules/chains/feature-flags/feature-flag.service.interface';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';
import { SafenetChecksController } from '#/modules/safenet/routes/safenet-checks.controller';
import { SafenetChecksService } from '#/modules/safenet/routes/safenet-checks.service';
import { spaceBuilder } from '#/modules/spaces/domain/entities/__tests__/space.entity.db.builder';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { AUTH_PAYLOAD_REQUEST_PROPERTY } from '#/routes/common/auth/auth-payload.request';

const CHAIN_ID = '100';
const DAILY_LIMIT = 1;

describe('SafenetChecksController', () => {
  let app: TestApplication;
  let transaction: MultisigTransaction;
  const queuedJobIds = new Set<string>();
  const queue = {
    setGlobalConcurrency: vi.fn(),
    add: vi.fn((_name: string, _data: unknown, options: { jobId: string }) => {
      queuedJobIds.add(options.jobId);
    }),
    getJob: vi.fn((jobId: string) =>
      queuedJobIds.has(jobId) ? { id: jobId } : undefined,
    ),
  } as unknown as MockedObject<Queue>;
  const featureFlags = {
    isFeatureEnabled: vi.fn(),
  } as MockedObject<IFeatureFlagService>;
  const members = {
    find: vi.fn(),
  } as MockedObject<IMembersRepository>;
  const spaceSafes = {
    existsInSpace: vi.fn(),
  } as MockedObject<ISpaceSafesRepository>;
  const billing = {
    getSubscriptionsByCustomerId: vi.fn(),
  } as MockedObject<IBillingRepository>;
  const safeRepository = {
    getSafe: vi.fn(),
    getMultiSigTransaction: vi.fn(),
  } as MockedObject<ISafeRepository>;

  const owner = privateKeyToAccount(generatePrivateKey());
  const safe = safeBuilder()
    .with('owners', [owner.address])
    .with('nonce', 0)
    .with('version', '1.4.1')
    .build();

  const subscriptionOf = (
    type: (typeof PlanTypes)[number],
    status: SubscriptionStatus = 'active',
  ) =>
    subscriptionBuilder()
      .with('status', status)
      .with('plan', subscriptionPlanBuilder().with('type', type).build())
      .build();

  const requestCheck = () =>
    request(app.getHttpServer())
      .post(`/v1/chains/${CHAIN_ID}/safes/${safe.address}/safenet/checks`)
      .send({ safeTxHash: transaction.safeTxHash });

  beforeAll(async () => {
    const configuration = new FakeConfigurationService();
    configuration.set('safenet.checksPerSpacePerDay', DAILY_LIMIT);
    configuration.set('expirationTimeInSeconds.safenetDailyCheckCounter', 60);
    const moduleFixture = await Test.createTestingModule({
      controllers: [SafenetChecksController],
      providers: [
        SafenetChecksService,
        SafenetChecksQueue,
        { provide: getQueueToken(SAFENET_CHECKS_QUEUE), useValue: queue },
        { provide: IConfigurationService, useValue: configuration },
        { provide: IFeatureFlagService, useValue: featureFlags },
        { provide: IMembersRepository, useValue: members },
        { provide: ISpaceSafesRepository, useValue: spaceSafes },
        { provide: IBillingRepository, useValue: billing },
        { provide: ISafeRepository, useValue: safeRepository },
        { provide: CacheService, useValue: new FakeCacheService() },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext): boolean => {
          context.switchToHttp().getRequest()[AUTH_PAYLOAD_REQUEST_PROPERTY] =
            siweAuthPayloadDtoBuilder().build();
          return true;
        },
      })
      .compile();
    app = createTestApplication(moduleFixture);
    await initTestApplication(app);
  });

  beforeEach(async () => {
    queuedJobIds.clear();
    featureFlags.isFeatureEnabled.mockResolvedValue(true);
    members.find.mockResolvedValue([
      memberBuilder().with('space', spaceBuilder().build()).build(),
    ]);
    spaceSafes.existsInSpace.mockResolvedValue(true);
    billing.getSubscriptionsByCustomerId.mockResolvedValue([
      subscriptionOf('premium'),
    ]);
    safeRepository.getSafe.mockResolvedValue(safe);
    transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', 1)
      .buildWithConfirmations({ chainId: CHAIN_ID, safe, signers: [owner] });
    safeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
  });

  afterAll(async () => {
    await app.close();
  });

  it('counts a transaction once and answers 429 for a second one past the daily limit', async () => {
    await requestCheck().expect(HttpStatus.ACCEPTED);
    await requestCheck().expect(HttpStatus.ACCEPTED);
    transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', 2)
      .buildWithConfirmations({ chainId: CHAIN_ID, safe, signers: [owner] });
    safeRepository.getMultiSigTransaction.mockResolvedValue(transaction);

    await requestCheck().expect(HttpStatus.TOO_MANY_REQUESTS);

    expect(queue.add).toHaveBeenCalledTimes(DAILY_LIMIT);
  });

  it('queues one check for an eligible workspace', async () => {
    await requestCheck().expect(HttpStatus.ACCEPTED);

    expect(queue.add).toHaveBeenCalledWith(
      'safenet-check',
      expect.objectContaining({ safeTxHash: transaction.safeTxHash }),
      {
        jobId:
          `${CHAIN_ID}-${safe.address}-${transaction.safeTxHash}`.toLowerCase(),
      },
    );
  });

  it('rejects a workspace whose plan is not eligible', async () => {
    billing.getSubscriptionsByCustomerId.mockResolvedValue([
      subscriptionOf('standard'),
    ]);

    await requestCheck().expect(HttpStatus.FORBIDDEN);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each<[string, () => unknown]>([
    ['has no active membership', () => members.find.mockResolvedValue([])],
    [
      'is not in a workspace that holds the Safe',
      () => spaceSafes.existsInSpace.mockResolvedValue(false),
    ],
  ])('rejects a caller who %s', async (_title, arrange) => {
    arrange();

    await requestCheck().expect(HttpStatus.FORBIDDEN);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it.each<[string, HttpStatus, () => unknown]>([
    [
      'a chain with the SAFENET_CHECKS feature off',
      HttpStatus.FORBIDDEN,
      () => featureFlags.isFeatureEnabled.mockResolvedValue(false),
    ],
    [
      'a transaction of another Safe',
      HttpStatus.UNPROCESSABLE_ENTITY,
      () =>
        safeRepository.getMultiSigTransaction.mockResolvedValue({
          ...transaction,
          safe: privateKeyToAccount(generatePrivateKey()).address,
        }),
    ],
    [
      'a Safe older than 1.3.0',
      HttpStatus.UNPROCESSABLE_ENTITY,
      () =>
        safeRepository.getSafe.mockResolvedValue({ ...safe, version: '1.2.0' }),
    ],
    [
      'an executed transaction',
      HttpStatus.UNPROCESSABLE_ENTITY,
      () =>
        safeRepository.getMultiSigTransaction.mockResolvedValue({
          ...transaction,
          isExecuted: true,
        }),
    ],
    [
      'a transaction below the Safe nonce',
      HttpStatus.UNPROCESSABLE_ENTITY,
      () =>
        safeRepository.getSafe.mockResolvedValue({
          ...safe,
          nonce: transaction.nonce + 1,
        }),
    ],
    [
      'a transaction confirmed only by a non-owner',
      HttpStatus.UNPROCESSABLE_ENTITY,
      () =>
        safeRepository.getMultiSigTransaction.mockResolvedValue({
          ...transaction,
          confirmations: [confirmationBuilder().build()],
        }),
    ],
  ])('rejects %s', async (_title, status, arrange) => {
    arrange();

    await requestCheck().expect(status);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues a check for a trialing subscription', async () => {
    billing.getSubscriptionsByCustomerId.mockResolvedValue([
      subscriptionOf('premium', 'trialing'),
    ]);

    await requestCheck().expect(HttpStatus.ACCEPTED);

    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
