// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpException, HttpStatus } from '@nestjs/common';

export const SAFE_SHIELD_DISABLED_ON_CORE_ERROR_CODE =
  'SAFE_SHIELD_DISABLED_ON_CORE';

/** Thrown when Safe Shield's recipient/counterparty analysis is disabled on Core. */
export class SafeShieldCoreDisabledError extends HttpException {
  public constructor() {
    super(
      {
        code: SAFE_SHIELD_DISABLED_ON_CORE_ERROR_CODE,
        message:
          'Recipient and counterparty analysis require a paid Space on Safe Shield.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
