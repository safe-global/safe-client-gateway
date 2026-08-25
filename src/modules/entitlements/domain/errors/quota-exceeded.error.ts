// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpException, HttpStatus } from '@nestjs/common';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';

export const QUOTA_EXCEEDED_ERROR_CODE = 'QUOTA_EXCEEDED';

/**
 * Carries what a client needs to react without knowing the feature.
 * `resetsAt` is `null` for a feature with no reset window.
 */
export class QuotaExceededError extends HttpException {
  public constructor(args: {
    feature: FeatureKey;
    quota: number;
    used: number;
    resetsAt: Date | null;
  }) {
    super(
      {
        code: QUOTA_EXCEEDED_ERROR_CODE,
        message: `Quota exceeded for ${args.feature}: ${args.used} of ${args.quota} used.`,
        feature: args.feature,
        quota: args.quota,
        used: args.used,
        resetsAt: args.resetsAt?.toISOString() ?? null,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
