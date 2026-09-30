// SPDX-License-Identifier: FSL-1.1-MIT
import { ConflictException, HttpStatus } from '@nestjs/common';
import type { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';

export const GAS_PAYMENT_OPTION_UNAVAILABLE_CODE =
  'GAS_PAYMENT_OPTION_UNAVAILABLE';

/** Why the requested gas payment option can't pay for the request. */
export const GAS_PAYMENT_OPTION_UNAVAILABLE_REASONS = [
  'NOT_LISTED',
  'NO_RELAYER',
  'NOT_A_WORKSPACE_SAFE',
  'REFUNDING_TRANSACTION',
] as const;

export type GasPaymentOptionUnavailableReason =
  (typeof GAS_PAYMENT_OPTION_UNAVAILABLE_REASONS)[number];

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
