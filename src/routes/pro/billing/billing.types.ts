export enum ProPageState {
  HOME = 'HOME',
  REGISTER = 'REGISTER',
  SELECT_PLAN = 'SELECT_PLAN',
  PAY_FOR_SUBSCRIPTION = 'PAY_FOR_SUBSCRIPTION',
  PAY_FOR_SUBSCRIPTION_IN_CRYPTO = 'PAY_FOR_SUBSCRIPTION_IN_CRYPTO',
  MANAGE_SUBSCRIPTION = 'MANAGE_SUBSCRIPTION',
  VIEW_INVOICES = 'VIEW_INVOICES',
  ACCOUNT_MANAGEMENT = 'ACCOUNT_MANAGEMENT',
}

export interface Customer {
  id: string;
  email: string | null;
  address: Address | null;
  created: number;
  metadata: CustomerMetadata;
  spaceId: string;
}

// Enums
export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  PAST_DUE = 'past_due',
  UNPAID = 'unpaid',
  TRIALING = 'trialing',
  PAUSED = 'paused',
}

// Interfaces
export interface Address {
  line1: string | undefined;
  city: string | undefined;
  state: string | undefined;
  postal_code: string | undefined;
  country: string | undefined;
}

export interface CustomerMetadata {
  [key: string]: string;
}

export interface PlanMetadata {
  [key: string]: string;
}

export type CustomerType = 'individual' | 'company';

// DTOs (Data Transfer Objects)
export interface CreateCustomerInputDto {
  spaceId: string;
  email: string;
  address: Address;
  customerType: CustomerType;
  name: string;
  companyName?: string;
  taxId?: string;
  vatId?: string;
}

export interface GetCustomerInputDto {
  spaceId: string;
}

export interface UpdateCustomerInputDto {
  safeAddress: string;
  email?: string;
  address?: Address;
}

export interface IsRegisteredInputDto {
  safeAddress: string;
}

export interface CreateSubscriptionInputDto {
  planId: string;
  spaceId: string;
}

export interface CancelSubscriptionInputDto {
  subscriptionId: string;
}

export interface GetInvoicesInputDto {
  safeAddress: string;
}

export interface GetSubscriptionsInputDto {
  safeAddress: string;
}

export interface UpdateSubscriptionInputDto {
  subscriptionId: string;
  newPriceLookupKey: string;
}

export interface UserSubscription {
  id: string;
  spaceId: string;
  plan: Plan;
  status: SubscriptionStatus;
  cancelledAt?: Date | null;
  createdAt?: Date | null;
  startAt?: Date | null;
  validUntil?: Date | null;
  autoRenews: boolean;
  cancellable: boolean;
}

export type Currency = 'usd' | 'eur' | 'gbp';
export type BillingCycle = 'monthly' | 'yearly' | undefined;
export type PlanType = 'standard' | 'premium' | 'enterprise';
export type PaymentMethod = 'fiat' | 'crypto';
export type SubscriptionCancelStatus = 'cancelled' | 'cannot_cannel';

export interface Plan {
  currentPrice: number;
  originalPrice: number;
  paymentMethod: PaymentMethod;
  currency: Currency;
  id: string;
  name?: string;
  description?: string;
  features: Array<string>;
  billingCycle: BillingCycle;
  type: PlanType;
}

// Response DTOs
export interface GetPlansResultDto {
  plans: Array<Plan>;
}

export interface GetCustomerResultDto {
  customer: {
    id: string;
    email: string | null;
    address: Address;
    created: number;
    spaceId: string;
    customerType: CustomerType;
    companyName?: string;
    name: string;
    taxId?: string;
    vatId?: string;
  };
}

export interface CreateCustomerResultDto {
  spaceId: string;
}

export interface IsRegisteredResultDto {
  isRegistered: boolean;
  subscriptions: Array<UserSubscription>;
}

export interface CreateSubscriptionResultDto {
  subscriptionId: string;
  clientSecret: string | null;
}

export interface CancelSubscriptionResultDto {
  subscriptionId: string;
  status: SubscriptionCancelStatus;
}

export interface Invoice {
  url: string;
  id: string;
  invoice_pdf: string;
  amount_paid: number;
  created: number;
}

export interface GetInvoicesResultDto {
  invoices: Array<Invoice>;
}

export interface GetSubscriptionsResultDto {
  subscriptions: Array<UserSubscription>;
}

export interface WebhookResultDto {
  status: string;
}

export interface SafeTransaction {
  to: string;
  value: string;
  data: string;
  operation: number;
  safeTxGas: string;
  baseGas: string;
  gasPrice: string;
  gasToken: string;
  refundReceiver: string;
  nonce: string;
  safeTxHash: string;
}

export interface GetTokenInfoDto {
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  chainId: number;
}

export interface CryptoPaymentIntentDto {
  customerId: string;
  chainId: number;
  planId: string;
  tokenAddress: string;
}

export interface UpdateCryptoPaymentIntentDto {
  subscriptionId: string;
  safeTxData: SafeTransaction;
}
