// SPDX-License-Identifier: FSL-1.1-MIT
import { HttpException, HttpStatus } from '@nestjs/common';

export const COPILOT_DISABLED_ON_CORE_ERROR_CODE = 'COPILOT_DISABLED_ON_CORE';

/** Thrown when Copilot's recipient/counterparty analysis is disabled on Core. */
export class CopilotCoreDisabledError extends HttpException {
  public constructor() {
    super(
      {
        code: COPILOT_DISABLED_ON_CORE_ERROR_CODE,
        message:
          'Recipient and counterparty analysis require a paid Space on Copilot.',
      },
      HttpStatus.PAYMENT_REQUIRED,
    );
  }
}
