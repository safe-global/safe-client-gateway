import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MemberUser {
  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String })
  email?: string;
}

export class AddressDto {
  @ApiPropertyOptional({ type: String })
  line1?: string;

  @ApiPropertyOptional({ type: String })
  city?: string;

  @ApiPropertyOptional({ type: String })
  state?: string;

  @ApiPropertyOptional({ type: String })
  postal_code?: string;

  @ApiPropertyOptional({ type: String })
  country?: string;
}

export class CustomerMetadataDto {
  @ApiProperty({ type: Object })
  metadata!: Record<string, string>;
}

export class CustomerDto {
  @ApiProperty({ type: String })
  id!: string;

  @ApiPropertyOptional({ type: String })
  email?: string;

  @ApiPropertyOptional({ type: AddressDto })
  address?: AddressDto;

  @ApiProperty({ type: Number })
  created!: number;

  @ApiProperty({ type: CustomerMetadataDto })
  metadata!: CustomerMetadataDto;

  @ApiProperty({ type: String })
  spaceId!: string;
}

export class PlanDto {
  @ApiProperty({ type: Number })
  currentPrice!: number;

  @ApiProperty({ type: Number })
  originalPrice!: number;

  @ApiProperty({ enum: ['fiat', 'crypto'] })
  paymentMethod!: 'fiat' | 'crypto';

  @ApiProperty({ enum: ['usd', 'eur', 'gbp'] })
  currency!: 'usd' | 'eur' | 'gbp';

  @ApiProperty({ type: String })
  id!: string;

  @ApiPropertyOptional({ type: String })
  name?: string;

  @ApiPropertyOptional({ type: String })
  description?: string;

  @ApiProperty({ type: [String] })
  features!: Array<string>;

  @ApiPropertyOptional({ enum: ['monthly', 'yearly'] })
  billingCycle?: 'monthly' | 'yearly';

  @ApiProperty({ enum: ['standard', 'premium', 'enterprise'] })
  type!: 'standard' | 'premium' | 'enterprise';
}

export class CreateCustomerInputDto {
  @ApiProperty({ type: String })
  spaceId!: string;

  @ApiProperty({ type: String })
  email!: string;

  @ApiProperty({ type: AddressDto })
  address!: AddressDto;

  @ApiProperty({ enum: ['individual', 'company'] })
  customerType!: 'individual' | 'company';

  @ApiProperty({ type: String })
  name!: string;

  @ApiPropertyOptional({ type: String })
  companyName?: string;

  @ApiPropertyOptional({ type: String })
  taxId?: string;

  @ApiPropertyOptional({ type: String })
  vatId?: string;
}

export class CreateSubscriptionInputDto {
  @ApiProperty({ type: String })
  planId!: string;

  @ApiProperty({ type: String })
  spaceId!: string;
}

export class CancelSubscriptionInputDto {
  @ApiProperty({ type: String })
  subscriptionId!: string;
}

export class InvoiceDto {
  @ApiProperty({ type: String })
  url!: string;

  @ApiProperty({ type: String })
  id!: string;

  @ApiProperty({ type: String })
  invoice_pdf!: string;

  @ApiProperty({ type: Number })
  amount_paid!: number;

  @ApiProperty({ type: Number })
  created!: number;
}


export class CanAccessFeatureDto {
    @ApiProperty({ type: Boolean })
    canAccess!: boolean;
}


export class GetInvoicesResultDto {
  @ApiProperty({ type: [InvoiceDto] })
  invoices!: Array<InvoiceDto>;
}
