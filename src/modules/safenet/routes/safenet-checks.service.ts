// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import semverSatisfies from 'semver/functions/satisfies';
import { type Address, type Hex, isAddressEqual } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { HttpExceptionNoLog } from '#/domain/common/errors/http-exception-no-log.error';
import { getBaseMultisigTransaction } from '#/domain/common/utils/safe';
import type { AuthPayload } from '#/modules/auth/domain/entities/auth-payload.entity';
import { getAuthenticatedUserIdOrFail } from '#/modules/auth/utils/assert-authenticated.utils';
import { IFeatureFlagService } from '#/modules/chains/feature-flags/feature-flag.service.interface';
import { IEntitlementEnforcement } from '#/modules/entitlements/domain/entitlement-enforcement.interface';
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
const UTC_DATE_LENGTH = 'YYYY-MM-DD'.length;

type SafeRequest = { chainId: string; safeAddress: Address; safeTxHash: Hex };
type SpaceSafeUser = {
  spaceId: Space['id'];
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
    @Inject(IEntitlementEnforcement)
    private readonly entitlements: IEntitlementEnforcement,
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
    args: SafeRequest & { spaceId: Space['id']; authPayload: AuthPayload },
  ): Promise<void> {
    const { authPayload, spaceId, ...request } = args;
    await this.assertEligible({
      spaceId,
      chainId: request.chainId,
      safeAddress: request.safeAddress,
      userId: getAuthenticatedUserIdOrFail(authPayload),
    });
    const jobData = await this.assertPayableTransaction(request);
    // A transaction that already has a job costs nothing; only a new job counts.
    if (await this.queue.has(jobData)) {
      return;
    }
    await this.assertWithinDailyLimit(spaceId);
    await this.queue.enqueue(jobData);
  }

  /** The caller is a member of the workspace in the path, which holds the Safe and the feature. */
  private async assertEligible(args: SpaceSafeUser): Promise<void> {
    await assertMember(this.members, args.spaceId, args.userId);
    const isOfferedOnChain = await this.featureFlags.isFeatureEnabled(
      args.chainId,
      SAFENET_CHECKS_FEATURE,
    );
    // A capability of the chain, not a permission of the caller: 501, not 403.
    if (!isOfferedOnChain) {
      throw new HttpExceptionNoLog(
        'Safenet checks are not available on this chain',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }
    assertAllowed(
      await this.spaceSafes.existsInSpace({
        spaceId: args.spaceId,
        chainId: args.chainId,
        address: args.safeAddress,
      }),
      'The Safe is not in this workspace',
    );
    // Checks ride on `policies`: both come with Business and Enterprise, and every
    // subscription carries it, unlike the newer `safenet_checks`. 402 otherwise.
    await this.entitlements.assertFeatureGranted({
      spaceId: args.spaceId,
      featureKey: 'policies',
    });
  }

  private async assertWithinDailyLimit(spaceId: Space['id']): Promise<void> {
    const day = new Date().toISOString().slice(0, UTC_DATE_LENGTH);
    const count = await this.cache.increment(
      CacheRouter.getSafenetChecksRateLimitCacheKey({
        spaceId,
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
      throw unprocessable('Safe version is older than 1.3.0');
    }
    if (!isAddressEqual(transaction.safe, safeAddress)) {
      throw unprocessable('Transaction belongs to another Safe');
    }
    if (transaction.isExecuted || transaction.nonce < safe.nonce) {
      throw unprocessable('Transaction is no longer pending');
    }
    // Trusts tx-service, which checks owners and signatures when a confirmation is submitted.
    if (!isSignedByOwner(transaction, safe)) {
      throw unprocessable('Transaction has no confirmation from a Safe owner');
    }
    return {
      chainId,
      safe: safeAddress,
      safeTxHash,
      transaction: getBaseMultisigTransaction(transaction),
    };
  }
}

function isSignedByOwner(
  transaction: MultisigTransaction,
  safe: Safe,
): boolean {
  return (transaction.confirmations ?? []).some(({ owner }) =>
    safe.owners.some((safeOwner) => isAddressEqual(safeOwner, owner)),
  );
}

function assertAllowed(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new HttpExceptionNoLog(message, HttpStatus.FORBIDDEN);
  }
}

function unprocessable(message: string): HttpExceptionNoLog {
  return new HttpExceptionNoLog(message, HttpStatus.UNPROCESSABLE_ENTITY);
}
