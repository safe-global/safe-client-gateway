// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpException, HttpStatus } from '@nestjs/common';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';

/**
 * A mutation would exceed the workspace's quota for a metered feature.
 * Rendered as a typed `402 QUOTA_EXCEEDED` body by
 * `QuotaExceededExceptionFilter` so clients can branch on it.
 */
export class QuotaExceededError extends HttpException {
  public readonly feature: FeatureKey;
  public readonly quota: number;
  public readonly used: number;
  public readonly resetsAt: Date | null;

  constructor(args: {
    feature: FeatureKey;
    quota: number;
    used: number;
    resetsAt: Date | null;
  }) {
    super(
      `Quota exceeded for ${args.feature} | quota: ${args.quota} | used: ${args.used}`,
      HttpStatus.PAYMENT_REQUIRED,
    );
    this.feature = args.feature;
    this.quota = args.quota;
    this.used = args.used;
    this.resetsAt = args.resetsAt;
  }
}
