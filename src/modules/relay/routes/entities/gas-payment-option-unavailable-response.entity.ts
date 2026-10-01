// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import { GasPaymentOption } from '@/modules/relay/domain/entities/gas-payment-option.entity';
import {
  GAS_PAYMENT_OPTION_UNAVAILABLE_CODE,
  GAS_PAYMENT_OPTION_UNAVAILABLE_REASONS,
  type GasPaymentOptionUnavailableReason,
} from '@/modules/relay/domain/errors/gas-payment-option-unavailable.error';

export class GasPaymentOptionUnavailableResponse {
  @ApiProperty({ enum: [GAS_PAYMENT_OPTION_UNAVAILABLE_CODE] })
  code!: typeof GAS_PAYMENT_OPTION_UNAVAILABLE_CODE;

  @ApiProperty({
    description:
      'Human-readable description of the error. Informational only; do not parse.',
  })
  message!: string;

  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({
    enum: GasPaymentOption,
    description: 'The gas payment option the request needed.',
  })
  requested!: GasPaymentOption;

  @ApiProperty({
    enum: GAS_PAYMENT_OPTION_UNAVAILABLE_REASONS,
    description:
      'NOT_LISTED: the chain does not list the option. NO_RELAYER: the chain has no relayer. ' +
      'NOT_A_WORKSPACE_SAFE: the Safe is not one the workspace holds.',
  })
  reason!: GasPaymentOptionUnavailableReason;

  @ApiProperty({
    enum: GasPaymentOption,
    isArray: true,
    description: 'The options the chain lists; empty without a relayer.',
  })
  available!: Array<GasPaymentOption>;
}
