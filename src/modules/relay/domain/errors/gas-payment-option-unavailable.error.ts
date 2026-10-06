// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException, HttpStatus } from '@nestjs/common';
import type { GasPaymentOption } from '#/modules/relay/domain/entities/gas-payment-option.entity';
import {
  GAS_PAYMENT_OPTION_UNAVAILABLE_CODE,
  type GasPaymentOptionUnavailableReason,
} from '#/modules/relay/domain/entities/gas-payment-option-unavailable.entity';

/** The requested option isn't offered for this request. */
export class GasPaymentOptionUnavailableError extends ConflictException {
  constructor(args: {
    requested: GasPaymentOption;
    reason: GasPaymentOptionUnavailableReason;
    available: ReadonlyArray<GasPaymentOption>;
  }) {
    super({
      code: GAS_PAYMENT_OPTION_UNAVAILABLE_CODE,
      message: `Gas payment option ${args.requested} is unavailable: ${args.reason}`,
      statusCode: HttpStatus.CONFLICT,
      requested: args.requested,
      reason: args.reason,
      available: args.available,
    });
  }
}
