// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty } from '@nestjs/swagger';
import type { CheckoutSessionResult as DomainCheckoutSessionResult } from '@/datasources/billing-api/entities/checkout-session.entity';

export class CheckoutSessionResult implements DomainCheckoutSessionResult {
  @ApiProperty()
  sessionId!: string;
  @ApiProperty()
  url!: string;
}
