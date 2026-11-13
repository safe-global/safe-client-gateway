// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { HttpException, HttpStatus } from '@nestjs/common';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import { FakeCacheService } from '#/datasources/cache/__tests__/fake.cache.service';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import { siweAuthPayloadDtoBuilder } from '#/modules/auth/domain/entities/__tests__/auth-payload-dto.entity.builder';
import { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import type { IFeatureFlagService } from '#/modules/chains/feature-flags/feature-flag.service.interface';
import type { IEntitlementEnforcement } from '#/modules/entitlements/domain/entitlement-enforcement.interface';
import { FeatureNotGrantedError } from '#/modules/entitlements/domain/errors/feature-not-granted.error';
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

  let spaceId: number;
  let transaction: MultisigTransaction;
  let cache: FakeCacheService;
  let featureFlags: MockedObject<IFeatureFlagService>;
  let members: MockedObject<Pick<IMembersRepository, 'findOne'>>;
  let spaceSafes: MockedObject<Pick<ISpaceSafesRepository, 'existsInSpace'>>;
  let entitlements: MockedObject<
    Pick<IEntitlementEnforcement, 'assertFeatureGranted'>
  >;
  let safeRepository: MockedObject<
    Pick<ISafeRepository, 'getSafe' | 'getMultiSigTransaction'>
  >;
  let queue: MockedObject<Pick<SafenetChecksQueue, 'has' | 'enqueue'>>;
  let target: SafenetChecksService;

  const buildTransaction = (nonce: number): Promise<MultisigTransaction> =>
    multisigTransactionBuilder()
      .with('safe', safe.address)
      .with('isExecuted', false)
      .with('nonce', nonce)
      .buildWithConfirmations({ chainId: CHAIN_ID, safe, signers: [owner] });

  const requestCheck = (): Promise<void> =>
    target.requestCheck({
      spaceId,
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
    spaceId = faker.number.int({ min: 1 });
    transaction = await buildTransaction(1);
    cache = new FakeCacheService();
    featureFlags = { isFeatureEnabled: vi.fn().mockResolvedValue(true) };
    members = { findOne: vi.fn().mockResolvedValue(memberBuilder().build()) };
    spaceSafes = { existsInSpace: vi.fn().mockResolvedValue(true) };
    entitlements = {
      assertFeatureGranted: vi.fn().mockResolvedValue(undefined),
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
      entitlements as MockedObject<IEntitlementEnforcement>,
      safeRepository as MockedObject<ISafeRepository>,
      queue as MockedObject<SafenetChecksQueue>,
      cache,
    );
  });

  it('queues the job of the transaction, checking the workspace in the request', async () => {
    await requestCheck();

    expect(members.findOne).toHaveBeenCalledWith({
      user: { id: userId },
      space: { id: spaceId },
      status: 'ACTIVE',
    });
    expect(spaceSafes.existsInSpace).toHaveBeenCalledWith({
      spaceId,
      chainId: CHAIN_ID,
      address: safe.address,
    });
    expect(entitlements.assertFeatureGranted).toHaveBeenCalledWith({
      spaceId,
      featureKey: 'policies',
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

  it('checks eligibility before it reads the transaction', async () => {
    members.findOne.mockResolvedValue(null);
    safeRepository.getMultiSigTransaction.mockResolvedValue({
      ...transaction,
      isExecuted: true,
    });

    await expectRejection(HttpStatus.FORBIDDEN);

    expect(featureFlags.isFeatureEnabled).not.toHaveBeenCalled();
    expect(entitlements.assertFeatureGranted).not.toHaveBeenCalled();
    expect(safeRepository.getSafe).not.toHaveBeenCalled();
    expect(safeRepository.getMultiSigTransaction).not.toHaveBeenCalled();
  });

  it('rejects a chain that does not offer checks with 501', async () => {
    featureFlags.isFeatureEnabled.mockResolvedValue(false);

    await expectRejection(HttpStatus.NOT_IMPLEMENTED);

    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a workspace that does not hold the Safe with 403', async () => {
    spaceSafes.existsInSpace.mockResolvedValue(false);

    await expectRejection(HttpStatus.FORBIDDEN);

    expect(entitlements.assertFeatureGranted).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('rejects a workspace without the entitlement with 402 before it reads the transaction', async () => {
    entitlements.assertFeatureGranted.mockRejectedValue(
      new FeatureNotGrantedError('policies'),
    );

    await expectRejection(HttpStatus.PAYMENT_REQUIRED);

    expect(safeRepository.getMultiSigTransaction).not.toHaveBeenCalled();
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
