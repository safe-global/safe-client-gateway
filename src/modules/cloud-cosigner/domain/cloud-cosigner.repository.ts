// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address, Hex } from 'viem';
import { PostgresDatabaseService } from '@/datasources/db/v2/postgres-database.service';
import { CloudCosignerPolicy as DbCloudCosignerPolicy } from '@/modules/cloud-cosigner/datasources/entities/cloud-cosigner-policy.entity.db';
import { CloudCosignerReview as DbCloudCosignerReview } from '@/modules/cloud-cosigner/datasources/entities/cloud-cosigner-review.entity.db';
import type {
  ICloudCosignerRepository,
  ReviewClaim,
  ReviewResult,
} from '@/modules/cloud-cosigner/domain/cloud-cosigner.repository.interface';
import {
  type CloudCosignerPolicy,
  type SafeCloudCosignerPolicy,
  SafeCloudCosignerPolicySchema,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-policy.entity';
import {
  type CloudCosignerReview,
  CloudCosignerReviewSchema,
  ReviewStatus,
  TERMINAL_REVIEW_STATUSES,
} from '@/modules/cloud-cosigner/domain/entities/cloud-cosigner-review.entity';

@Injectable()
export class CloudCosignerRepository implements ICloudCosignerRepository {
  constructor(
    @Inject(PostgresDatabaseService)
    private readonly postgresDatabaseService: PostgresDatabaseService,
  ) {}

  public async getPolicy(args: {
    chainId: string;
    safeAddress: Address;
  }): Promise<SafeCloudCosignerPolicy | null> {
    const repository = await this.postgresDatabaseService.getRepository(
      DbCloudCosignerPolicy,
    );
    const policy = await repository.findOne({
      where: { chainId: args.chainId, safeAddress: args.safeAddress },
    });
    return policy ? SafeCloudCosignerPolicySchema.parse(policy) : null;
  }

  public async upsertPolicy(args: {
    chainId: string;
    safeAddress: Address;
    policy: CloudCosignerPolicy;
  }): Promise<SafeCloudCosignerPolicy> {
    const repository = await this.postgresDatabaseService.getRepository(
      DbCloudCosignerPolicy,
    );
    await repository.upsert(
      {
        chainId: args.chainId,
        safeAddress: args.safeAddress,
        ...args.policy,
      },
      { conflictPaths: ['chainId', 'safeAddress'] },
    );
    const policy = await repository.findOneOrFail({
      where: { chainId: args.chainId, safeAddress: args.safeAddress },
    });
    return SafeCloudCosignerPolicySchema.parse(policy);
  }

  public async getReview(args: {
    chainId: string;
    safeTxHash: Hex;
  }): Promise<CloudCosignerReview | null> {
    const repository = await this.postgresDatabaseService.getRepository(
      DbCloudCosignerReview,
    );
    const review = await repository.findOne({
      where: { chainId: args.chainId, safeTxHash: args.safeTxHash },
    });
    return review ? CloudCosignerReviewSchema.parse(review) : null;
  }

  public claimReview(args: {
    chainId: string;
    safeAddress: Address;
    safeTxHash: Hex;
    stalePendingAfterMs: number;
  }): Promise<ReviewClaim> {
    return this.postgresDatabaseService.transaction(async (entityManager) => {
      const repository = entityManager.getRepository(DbCloudCosignerReview);
      const inserted = await repository
        .createQueryBuilder()
        .insert()
        .values({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
          safeTxHash: args.safeTxHash,
          status: ReviewStatus.PENDING,
          mode: null,
          triggeredRules: [],
          summary: null,
          riskFlags: [],
          model: null,
          signature: null,
        })
        .orIgnore()
        .returning('id')
        .execute();

      const existing = await repository.findOneOrFail({
        where: { chainId: args.chainId, safeTxHash: args.safeTxHash },
        lock: { mode: 'pessimistic_write' },
      });

      // `identifiers` is derived from the input even when ON CONFLICT DO
      // NOTHING skipped the row; only the RETURNING rows prove an insert.
      const insertedRows: Array<unknown> = inserted.raw;
      if (insertedRows.length > 0) {
        return {
          claimed: true,
          review: CloudCosignerReviewSchema.parse(existing),
        };
      }

      if (TERMINAL_REVIEW_STATUSES.includes(existing.status)) {
        return {
          claimed: false,
          review: CloudCosignerReviewSchema.parse(existing),
        };
      }

      const isStalePending =
        existing.status === ReviewStatus.PENDING &&
        Date.now() - existing.updatedAt.getTime() > args.stalePendingAfterMs;
      if (existing.status === ReviewStatus.PENDING && !isStalePending) {
        return {
          claimed: false,
          review: CloudCosignerReviewSchema.parse(existing),
        };
      }

      await repository.update(existing.id, {
        status: ReviewStatus.PENDING,
        summary: null,
      });
      const reclaimed = await repository.findOneOrFail({
        where: { id: existing.id },
      });
      return {
        claimed: true,
        review: CloudCosignerReviewSchema.parse(reclaimed),
      };
    });
  }

  public async completeReview(args: {
    id: CloudCosignerReview['id'];
    result: ReviewResult;
  }): Promise<CloudCosignerReview> {
    const repository = await this.postgresDatabaseService.getRepository(
      DbCloudCosignerReview,
    );
    await repository.update(args.id, args.result);
    const review = await repository.findOneOrFail({ where: { id: args.id } });
    return CloudCosignerReviewSchema.parse(review);
  }

  public async failReview(args: {
    id: CloudCosignerReview['id'];
    summary: string;
  }): Promise<void> {
    const repository = await this.postgresDatabaseService.getRepository(
      DbCloudCosignerReview,
    );
    await repository.update(args.id, {
      status: ReviewStatus.FAILED,
      summary: args.summary,
    });
  }
}
