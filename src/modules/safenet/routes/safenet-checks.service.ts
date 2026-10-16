// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import semverSatisfies from 'semver/functions/satisfies';
import { type Address, type Hex, isAddressEqual } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import type { PlanTypes } from '#/datasources/billing-api/entities/plan.entity';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import { IBillingRepository } from '#/modules/billing/domain/billing.repository.interface';
import { IFeatureFlagService } from '#/modules/chains/feature-flags/feature-flag.service.interface';
import { isActiveSubscriptionStatus } from '#/modules/entitlements/domain/entitlements.constants';
import type { MultisigTransaction } from '#/modules/safe/domain/entities/multisig-transaction.entity';
import type { Safe } from '#/modules/safe/domain/entities/safe.entity';
import { ISafeRepository } from '#/modules/safe/domain/safe.repository.interface';
import type { SafenetCheckJobData } from '#/modules/safenet/domain/entities/safenet-check-job-data.entity';
import { SafenetChecksQueue } from '#/modules/safenet/domain/safenet-checks-queue.service';
import type { Space } from '#/modules/spaces/domain/entities/space.entity';
import { ISpaceSafesRepository } from '#/modules/spaces/domain/safes/space-safes.repository.interface';
import { assertMember } from '#/modules/spaces/domain/space-assert.utils';
import { IMembersRepository } from '#/modules/users/domain/members/members.repository.interface';

const SAFENET_CHECKS_FEATURE = 'SAFENET_CHECKS';
// Consensus always hashes a Safe transaction with the 1.3.0+ domain.
const MIN_SAFE_VERSION = '>=1.3.0';
// Plan types whose active or trialing subscription includes sponsored checks.
const ELIGIBLE_PLAN_TYPES: ReadonlyArray<(typeof PlanTypes)[number]> = [
  'premium',
  'enterprise',
];
const UTC_DATE_LENGTH = 'YYYY-MM-DD'.length;

type SafeRequest = { chainId: string; safeAddress: Address; safeTxHash: Hex };
type SpaceRef = Pick<Space, 'id' | 'uuid'>;
type SpaceSafeUser = {
  space: SpaceRef;
  chainId: string;
  safeAddress: Address;
  userId: number;
};

@Injectable()
export class SafenetChecksService {
  private readonly checksPerSpacePerDay: number;
  private readonly dayTtlSeconds: number;

  constructor(
    @Inject(IConfigurationService) configuration: IConfigurationService,
    @Inject(IFeatureFlagService)
    private readonly featureFlags: IFeatureFlagService,
    @Inject(IMembersRepository)
    private readonly members: IMembersRepository,
    @Inject(ISpaceSafesRepository)
    private readonly spaceSafes: ISpaceSafesRepository,
    @Inject(IBillingRepository) private readonly billing: IBillingRepository,
    @Inject(ISafeRepository) private readonly safeRepository: ISafeRepository,
    private readonly queue: SafenetChecksQueue,
    @Inject(CacheService) private readonly cache: ICacheService,
  ) {
    this.checksPerSpacePerDay = configuration.getOrThrow(
      'safenet.checksPerSpacePerDay',
    );
    this.dayTtlSeconds = configuration.getOrThrow(
      'expirationTimeInSeconds.safenetDailyCheckCounter',
    );
  }

  /** Eligibility goes first, so an ineligible caller learns nothing about the transaction. */
  public async requestCheck(
    args: SafeRequest & { space: SpaceRef; authPayload: AuthPayload },
  ): Promise<void> {
    const { authPayload, space, ...request } = args;
    await this.assertEligible({
      space,
      chainId: request.chainId,
      safeAddress: request.safeAddress,
      userId: getAuthenticatedUserIdOrFail(authPayload),
    });
    const jobData = await this.assertPayableTransaction(request);
    // A transaction that already has a job costs nothing; only a new job counts.
    if (await this.queue.has(jobData)) {
      return;
    }
    await this.assertWithinDailyLimit(space);
    await this.queue.enqueue(jobData);
  }

  /** The caller is a member of the workspace in the path, which holds the Safe on an eligible plan. */
  private async assertEligible(args: SpaceSafeUser): Promise<void> {
    await assertMember(this.members, args.space.id, args.userId);
    this.assertAllowed(
      await this.featureFlags.isFeatureEnabled(
        args.chainId,
        SAFENET_CHECKS_FEATURE,
      ),
      'Safenet checks are not available on this chain',
    );
    this.assertAllowed(
      await this.spaceSafes.existsInSpace({
        spaceId: args.space.id,
        chainId: args.chainId,
        address: args.safeAddress,
      }),
      'The Safe is not in this workspace',
    );
    this.assertAllowed(
      await this.hasEligiblePlan(args.space),
      'The workspace plan does not include Safenet checks',
    );
  }

  private async hasEligiblePlan(space: SpaceRef): Promise<boolean> {
    const subscriptions = await this.billing.getSubscriptionsByCustomerId({
      upstreamCustomerId: space.uuid,
    });
    return subscriptions.some(
      ({ status, plan }) =>
        isActiveSubscriptionStatus(status) &&
        ELIGIBLE_PLAN_TYPES.includes(plan.type),
    );
  }

  private async assertWithinDailyLimit(space: SpaceRef): Promise<void> {
    const day = new Date().toISOString().slice(0, UTC_DATE_LENGTH);
    const count = await this.cache.increment(
      CacheRouter.getSafenetChecksRateLimitCacheKey({
        spaceId: space.id,
        day,
      }),
      this.dayTtlSeconds,
      0,
    );
    // A non-numeric Redis reply must not open the spend cap.
    if (!Number.isFinite(count) || count > this.checksPerSpacePerDay) {
      throw new HttpExceptionNoLog(
        'Daily Safenet check limit reached for this workspace',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Asserts a pending transaction of this Safe that a current owner signed; returns its job. */
  private async assertPayableTransaction(
    args: SafeRequest,
  ): Promise<SafenetCheckJobData> {
    const { chainId, safeAddress, safeTxHash } = args;
    const [safe, transaction] = await Promise.all([
      this.safeRepository.getSafe({ chainId, address: safeAddress }),
      this.safeRepository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: safeTxHash,
      }),
    ]);
    if (!semverSatisfies(safe.version ?? '', MIN_SAFE_VERSION)) {
      throw this.reject('Safe version is older than 1.3.0');
    }
    if (!isAddressEqual(transaction.safe, safeAddress)) {
      throw this.reject('Transaction belongs to another Safe');
    }
    if (transaction.isExecuted || transaction.nonce < safe.nonce) {
      throw this.reject('Transaction is no longer pending');
    }
    if (!this.isSignedByOwner(transaction, safe)) {
      throw this.reject('Transaction has no confirmation from a Safe owner');
    }
    return {
      chainId,
      safe: safeAddress,
      safeTxHash,
      transaction: getBaseMultisigTransaction(transaction),
    };
  }

  private isSignedByOwner(
    transaction: MultisigTransaction,
    safe: Safe,
  ): boolean {
    return (transaction.confirmations ?? []).some(({ owner }) =>
      safe.owners.some((safeOwner) => isAddressEqual(safeOwner, owner)),
    );
  }

  private assertAllowed(
    condition: unknown,
    message: string,
  ): asserts condition {
    if (!condition) {
      throw new HttpExceptionNoLog(message, HttpStatus.FORBIDDEN);
    }
  }

  private reject(message: string): HttpExceptionNoLog {
    return new HttpExceptionNoLog(message, HttpStatus.UNPROCESSABLE_ENTITY);
  }
}
