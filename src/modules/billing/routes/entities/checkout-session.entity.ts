// SPDX-License-Identifier: FSL-1.1-MIT
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { CheckoutSession as DomainCheckoutSession } from '@/datasources/billing-api/entities/checkout-session.entity';

// camelCase; the domain entity mirrors the upstream (snake_case) format verbatim.
export class CheckoutSession {
  @ApiProperty()
  id!: string;
  @ApiProperty()
  object!: string;
  @ApiProperty()
  amountSubtotal!: number;
  @ApiProperty()
  amountTotal!: number;
  @ApiProperty()
  cancelUrl!: string;
  @ApiPropertyOptional({ nullable: true })
  clientReferenceId?: string | null;
  @ApiProperty()
  created!: number;
  @ApiProperty()
  currency!: string;
  @ApiPropertyOptional({ nullable: true })
  customer?: string | null;
  @ApiProperty()
  expiresAt!: number;
  @ApiProperty({ type: Object })
  metadata!: Record<string, unknown>;
  @ApiProperty()
  mode!: string;
  @ApiProperty()
  paymentStatus!: string;
  @ApiProperty()
  status!: string;
  @ApiProperty()
  successUrl!: string;
  @ApiPropertyOptional({ nullable: true })
  url?: string | null;
  @ApiPropertyOptional({ nullable: true })
  subscription?: string | null;
  @ApiPropertyOptional({ nullable: true })
  invoice?: string | null;
}

export function toCheckoutSessionDto(
  session: DomainCheckoutSession,
): CheckoutSession {
  return {
    id: session.id,
    object: session.object,
    amountSubtotal: session.amount_subtotal,
    amountTotal: session.amount_total,
    cancelUrl: session.cancel_url,
    clientReferenceId: session.client_reference_id,
    created: session.created,
    currency: session.currency,
    customer: session.customer,
    expiresAt: session.expires_at,
    metadata: session.metadata,
    mode: session.mode,
    paymentStatus: session.payment_status,
    status: session.status,
    successUrl: session.success_url,
    url: session.url,
    subscription: session.subscription,
    invoice: session.invoice,
  };
}
