// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
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
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { CacheService } from '#/datasources/cache/cache.service.interface';
import { JobType } from '#/datasources/job-queue/types/job-types';
import { SAFENET_CHECKS_QUEUE } from '#/domain/common/jobs.constants';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthGuard } from '#/modules/auth/routes/guards/auth.guard';
import { IFeatureFlagService } from '#/modules/chains/feature-flags/feature-flag.service.interface';
import { IEntitlementEnforcement } from '#/modules/entitlements/domain/entitlement-enforcement.interface';
import { FeatureNotGrantedError } from '#/modules/entitlements/domain/errors/feature-not-granted.error';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';
import { SafenetChecksController } from '#/modules/safenet/routes/safenet-checks.controller';
import { SafenetChecksService } from '#/modules/safenet/routes/safenet-checks.service';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { ISpacesRepository } from '#/modules/spaces/domain/spaces.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';
import { AUTH_PAYLOAD_REQUEST_PROPERTY } from '#/routes/common/auth/auth-payload.request';

const CHAIN_ID = '100';
const DAILY_LIMIT = 1;

// The service branches are in safenet-checks.service.spec.ts; this covers the route wiring.
describe('SafenetChecksController', () => {
  let app: TestApplication;
  let transaction: MultisigTransaction;
  let spaceId: number;
  let spaceUuid: string;
  const queue = {
    setGlobalConcurrency: vi.fn(),
    add: vi.fn(),
    getJob: vi.fn(),
  } as MockedObject<Queue>;
  const featureFlags = {
    isFeatureEnabled: vi.fn(),
  } as MockedObject<IFeatureFlagService>;
  const members = {
    findOne: vi.fn(),
  } as MockedObject<IMembersRepository>;
  const spaces = {
    findIdByUuid: vi.fn(),
  } as MockedObject<ISpacesRepository>;
  const spaceSafes = {
    existsInSpace: vi.fn(),
  } as MockedObject<ISpaceSafesRepository>;
  const entitlements = {
    assertFeatureGranted: vi.fn(),
  } as MockedObject<IEntitlementEnforcement>;
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

  const useTransaction = async (nonce: number): Promise<void> => {
    transaction = await multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', nonce)
      .buildWithConfirmations({ chainId: CHAIN_ID, safe, signers: [owner] });
    safeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
  };

  const requestCheck = (spaceId: string = spaceUuid) =>
    request(app.getHttpServer())
      .post(
        `/v1/spaces/${spaceId}/chains/${CHAIN_ID}/safes/${safe.address}/safenet/checks`,
      )
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
        { provide: ISpacesRepository, useValue: spaces },
        { provide: ISpaceSafesRepository, useValue: spaceSafes },
        { provide: IEntitlementEnforcement, useValue: entitlements },
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
    queue.getJob.mockResolvedValue(undefined);
    // A new workspace per test, so the daily counter starts empty.
    spaceId = faker.number.int({ min: 1 });
    spaceUuid = faker.string.uuid();
    spaces.findIdByUuid.mockResolvedValue(spaceId);
    featureFlags.isFeatureEnabled.mockResolvedValue(true);
    members.findOne.mockResolvedValue(memberBuilder().build());
    spaceSafes.existsInSpace.mockResolvedValue(true);
    entitlements.assertFeatureGranted.mockResolvedValue(undefined);
    safeRepository.getSafe.mockResolvedValue(safe);
    await useTransaction(1);
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 202 and queues one job for the workspace in the path', async () => {
    await requestCheck().expect(HttpStatus.ACCEPTED);

    expect(spaceSafes.existsInSpace).toHaveBeenCalledWith({
      spaceId,
      chainId: CHAIN_ID,
      address: safe.address,
    });
    expect(entitlements.assertFeatureGranted).toHaveBeenCalledWith({
      spaceId,
      featureKey: 'safenet_checks',
    });
    expect(queue.add).toHaveBeenCalledWith(
      JobType.SAFENET_CHECK,
      {
        chainId: CHAIN_ID,
        safe: safe.address,
        safeTxHash: transaction.safeTxHash,
        transaction: getBaseMultisigTransaction(transaction),
      },
      {
        jobId:
          `${CHAIN_ID}-${safe.address}-${transaction.safeTxHash}`.toLowerCase(),
      },
    );
  });

  it('answers 400 for a workspace id that is not a UUID', async () => {
    await requestCheck(String(spaceId)).expect(HttpStatus.BAD_REQUEST);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('answers 403 to a caller who is not a member of the workspace', async () => {
    members.findOne.mockResolvedValue(null);

    await requestCheck().expect(HttpStatus.FORBIDDEN);

    expect(queue.add).not.toHaveBeenCalled();
  });

  it('answers 402 to a workspace whose plan does not grant safenet_checks', async () => {
    entitlements.assertFeatureGranted.mockRejectedValue(
      new FeatureNotGrantedError('safenet_checks'),
    );

    const response = await requestCheck().expect(HttpStatus.PAYMENT_REQUIRED);

    expect(response.body).toMatchObject({
      code: 'FEATURE_NOT_GRANTED',
      feature: 'safenet_checks',
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('answers 429 past the daily limit of the workspace', async () => {
    await requestCheck().expect(HttpStatus.ACCEPTED);
    await useTransaction(2);

    await requestCheck().expect(HttpStatus.TOO_MANY_REQUESTS);

    expect(queue.add).toHaveBeenCalledTimes(DAILY_LIMIT);
  });
});
