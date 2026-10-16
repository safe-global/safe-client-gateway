// SPDX-License-Identifier: FSL-1.1-MIT
import type { UUID } from 'node:crypto';
import { faker } from '@faker-js/faker';
import { HttpException, HttpStatus } from '@nestjs/common';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { subscriptionPlanBuilder } from '#/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '#/datasources/billing-api/entities/__tests__/subscription.builder';
import type { PlanTypes } from '#/datasources/billing-api/entities/plan.entity';
import {
  type SubscriptionStatus,
  SubscriptionStatuses,
} from '#/datasources/billing-api/entities/subscription.entity';
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { IBillingRepository } from '#/modules/billing/domain/billing.repository.interface';
import type { IFeatureFlagService } from '#/modules/chains/feature-flags/feature-flag.service.interface';
import { isActiveSubscriptionStatus } from '#/modules/entitlements/domain/entitlements.constants';
import { multisigTransactionBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { confirmationBuilder } from '#/modules/safe/domain/entities/__tests__/multisig-transaction-confirmation.builder';
import { safeBuilder } from '#/modules/safe/domain/entities/__tests__/safe.builder';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';
import { SafenetChecksService } from '#/modules/safenet/routes/safenet-checks.service';
import type { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { memberBuilder } from '#/modules/users/datasources/entities/__tests__/member.entity.db.builder';
import type { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

const CHAIN_ID = '100';
const DAILY_LIMIT = 1;

describe('SafenetChecksService', () => {
  const userId = faker.number.int({ min: 1 });
  const authPayload = new AuthPayload(
    siweAuthPayloadDtoBuilder().with('sub', String(userId)).build(),
  );
  const owner = privateKeyToAccount(generatePrivateKey());
  const safe = safeBuilder()
    .with('owners', [owner.address])
    .with('nonce', 0)
    .with('version', '1.4.1')
    .build();

  let space: { id: number; uuid: UUID };
  let transaction: MultisigTransaction;
  let cache: FakeCacheService;
  let featureFlags: MockedObject<IFeatureFlagService>;
  let members: MockedObject<Pick<IMembersRepository, 'findOne'>>;
  let spaceSafes: MockedObject<Pick<ISpaceSafesRepository, 'existsInSpace'>>;
  let billing: MockedObject<
    Pick<IBillingRepository, 'getSubscriptionsByCustomerId'>
  >;
  let safeRepository: MockedObject<
    Pick<ISafeRepository, 'getSafe' | 'getMultiSigTransaction'>
  >;
  let queue: MockedObject<Pick<SafenetChecksQueue, 'has' | 'enqueue'>>;
  let target: SafenetChecksService;

  const subscriptionOf = (
    type: (typeof PlanTypes)[number],
    status: SubscriptionStatus = 'active',
  ) =>
    subscriptionBuilder()
      .with('status', status)
      .with('plan', subscriptionPlanBuilder().with('type', type).build())
      .build();

  const buildTransaction = (nonce: number): Promise<MultisigTransaction> =>
    multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', nonce)
      .buildWithConfirmations({ chainId: CHAIN_ID, safe, signers: [owner] });

  const requestCheck = (): Promise<void> =>
    target.requestCheck({
      space,
      chainId: CHAIN_ID,
      safeAddress: safe.address,
      safeTxHash: transaction.safeTxHash,
      authPayload,
    });

  const expectRejection = async (status: HttpStatus): Promise<void> => {
    await expect(requestCheck()).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof HttpException && error.getStatus() === status,
    );
  };

  beforeEach(async () => {
    space = {
      id: faker.number.int({ min: 1 }),
      uuid: faker.string.uuid() as UUID,
    };
    transaction = await buildTransaction(1);
    cache = new FakeCacheService();
    featureFlags = { isFeatureEnabled: vi.fn().mockResolvedValue(true) };
    members = { findOne: vi.fn().mockResolvedValue(memberBuilder().build()) };
    spaceSafes = { existsInSpace: vi.fn().mockResolvedValue(true) };
    billing = {
      getSubscriptionsByCustomerId: vi
        .fn()
        .mockResolvedValue([subscriptionOf('premium')]),
    };
    safeRepository = {
      getSafe: vi.fn().mockResolvedValue(safe),
      getMultiSigTransaction: vi.fn().mockResolvedValue(transaction),
    };
    queue = {
      has: vi.fn().mockResolvedValue(false),
      enqueue: vi.fn().mockResolvedValue(undefined),
    };
    const configuration = new FakeConfigurationService();
    configuration.set('safenet.checksPerSpacePerDay', DAILY_LIMIT);
    configuration.set('expirationTimeInSeconds.safenetDailyCheckCounter', 60);
    target = new SafenetChecksService(
      configuration,
      featureFlags,
      members as MockedObject<IMembersRepository>,
      spaceSafes as MockedObject<ISpaceSafesRepository>,
      billing as MockedObject<IBillingRepository>,
      safeRepository as MockedObject<ISafeRepository>,
      queue as MockedObject<SafenetChecksQueue>,
      cache,
    );
  });

  it('queues the job of the transaction, checking the workspace in the request', async () => {
    await requestCheck();

    expect(members.findOne).toHaveBeenCalledWith({
      user: { id: userId },
      space: { id: space.id },
      status: 'ACTIVE',
    });
    expect(spaceSafes.existsInSpace).toHaveBeenCalledWith({
      spaceId: space.id,
      chainId: CHAIN_ID,
      address: safe.address,
    });
    expect(billing.getSubscriptionsByCustomerId).toHaveBeenCalledWith({
      upstreamCustomerId: space.uuid,
    });
    expect(queue.enqueue).toHaveBeenCalledWith({
      chainId: CHAIN_ID,
      safe: safe.address,
      safeTxHash: transaction.safeTxHash,
      transaction: getBaseMultisigTransaction(transaction),
    });
  });

  it('queues the transaction at the Safe nonce', async () => {
    safeRepository.getSafe.mockResolvedValue({
      ...safe,
      nonce: transaction.nonce,
    });

    await requestCheck();

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it.each<[(typeof PlanTypes)[number], SubscriptionStatus]>([
    ['premium', 'trialing'],
    ['enterprise', 'active'],
  ])('queues a check for a %s plan that is %s', async (type, status) => {
    billing.getSubscriptionsByCustomerId.mockResolvedValue([
      subscriptionOf(type, status),
    ]);

    await requestCheck();

    expect(queue.enqueue).toHaveBeenCalledTimes(1);
  });

  it('checks eligibility before it reads the transaction', async () => {
    members.findOne.mockResolvedValue(null);
    safeRepository.getMultiSigTransaction.mockResolvedValue({
      ...transaction,
      isExecuted: true,
    });

    await expectRejection(HttpStatus.FORBIDDEN);

    expect(featureFlags.isFeatureEnabled).not.toHaveBeenCalled();
    expect(billing.getSubscriptionsByCustomerId).not.toHaveBeenCalled();
    expect(safeRepository.getSafe).not.toHaveBeenCalled();
    expect(safeRepository.getMultiSigTransaction).not.toHaveBeenCalled();
  });

  it('rejects a chain that does not offer checks with 501', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValue(false);

    await expectRejection(HttpStatus.NOT_IMPLEMENTED);

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it.each<[string, () => unknown]>([
    [
      'a workspace that does not hold the Safe',
      () => spaceSafes.existsInSpace.mockResolvedValue(false),
    ],
    [
      'a plan type that is not eligible',
      () =>
        billing.getSubscriptionsByCustomerId.mockResolvedValue([
          subscriptionOf('standard'),
        ]),
    ],
  ])('rejects %s with 403', async (_title, arrange) => {
    arrange();

    await expectRejection(HttpStatus.FORBIDDEN);

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it.each(
    SubscriptionStatuses.filter(
      (status) => !isActiveSubscriptionStatus(status),
    ),
  )('rejects a premium plan whose subscription is %s', async (status) => {
    billing.getSubscriptionsByCustomerId.mockResolvedValue([
      subscriptionOf('premium', status),
    ]);

    await expectRejection(HttpStatus.FORBIDDEN);

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it.each<[string, () => unknown]>([
    [
      'a transaction of another Safe',
      () =>
        safeRepository.getMultiSigTransaction.mockResolvedValue({
          ...transaction,
          safe: privateKeyToAccount(generatePrivateKey()).address,
        }),
    ],
    [
      'a Safe older than 1.3.0',
      () =>
        safeRepository.getSafe.mockResolvedValue({ ...safe, version: '1.2.0' }),
    ],
    [
      'an executed transaction',
      () =>
        safeRepository.getMultiSigTransaction.mockResolvedValue({
          ...transaction,
          isExecuted: true,
        }),
    ],
    [
      'a transaction below the Safe nonce',
      () =>
        safeRepository.getSafe.mockResolvedValue({
          ...safe,
          nonce: transaction.nonce + 1,
        }),
    ],
    [
      'a transaction confirmed only by a non-owner',
      () =>
        safeRepository.getMultiSigTransaction.mockResolvedValue({
          ...transaction,
          confirmations: [confirmationBuilder().build()],
        }),
    ],
  ])('rejects %s with 422', async (_title, arrange) => {
    arrange();

    await expectRejection(HttpStatus.UNPROCESSABLE_ENTITY);

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  describe('daily limit', () => {
    const nextTransaction = async (): Promise<void> => {
      transaction = await buildTransaction(transaction.nonce + 1);
      safeRepository.getMultiSigTransaction.mockResolvedValue(transaction);
    };

    it('does not count a transaction that already has a job', async () => {
      await requestCheck();
      queue.has.mockResolvedValue(true);

      await requestCheck();

      expect(queue.enqueue).toHaveBeenCalledTimes(1);
      queue.has.mockResolvedValue(false);
      await nextTransaction();
      await expectRejection(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('starts a new count on the next UTC day', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      try {
        vi.setSystemTime(new Date('2026-10-20T23:59:00Z'));
        await requestCheck();
        await nextTransaction();
        await expectRejection(HttpStatus.TOO_MANY_REQUESTS);

        vi.setSystemTime(new Date('2026-10-21T00:01:00Z'));
        await requestCheck();

        expect(queue.enqueue).toHaveBeenCalledTimes(DAILY_LIMIT + 1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('fails closed when the counter is not a number', async () => {
      vi.spyOn(cache, 'increment').mockResolvedValue(Number.NaN);

      await expectRejection(HttpStatus.TOO_MANY_REQUESTS);

      expect(queue.enqueue).not.toHaveBeenCalled();
    });
  });
});
