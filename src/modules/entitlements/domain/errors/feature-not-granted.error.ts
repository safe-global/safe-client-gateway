// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpException, HttpStatus } from '@nestjs/common';
import type { FeatureKey } from '@/modules/entitlements/domain/entities/feature.entity';

export const FEATURE_NOT_GRANTED_ERROR_CODE = 'FEATURE_NOT_GRANTED';

/**
 * Thrown for a feature with no live usage to measure against — Binary,
 * never event-metered by design — that the current plan simply does not
 * grant.
 */
export class FeatureNotGrantedError extends HttpException {
  public constructor(feature: FeatureKey) {
    super(
      {
        code: FEATURE_NOT_GRANTED_ERROR_CODE,
        message: `Feature '${feature}' is not available on the current plan.`,
        feature,
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
