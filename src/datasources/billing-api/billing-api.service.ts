// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ZodError, z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import type {
  CheckoutSession,
  CheckoutSessionResult,
} from '@/datasources/billing-api/entities/checkout-session.entity';
import {
  CheckoutSessionResultSchema,
  CheckoutSessionSchema,
} from '@/datasources/billing-api/entities/checkout-session.entity';
import type { Customer } from '@/datasources/billing-api/entities/customer.entity';
import { CustomerSchema } from '@/datasources/billing-api/entities/customer.entity';
import type { PaymentLink } from '@/datasources/billing-api/entities/payment-link.entity';
import { PaymentLinkSchema } from '@/datasources/billing-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/billing-api/entities/plan.entity';
import { PlanSchema } from '@/datasources/billing-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/billing-api/entities/subscription.entity';
import { SubscriptionSchema } from '@/datasources/billing-api/entities/subscription.entity';
import type {
  SubscriptionUpdatePreview,
  UpdateSubscriptionResult,
} from '@/datasources/billing-api/entities/subscription-update.entity';
import {
  DEFAULT_PRORATION_BEHAVIOR,
  SubscriptionUpdatePreviewSchema,
  UpdateSubscriptionResultSchema,
} from '@/datasources/billing-api/entities/subscription-update.entity';
import { stripDashes } from '@/datasources/billing-api/upstream-customer-id.util';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';

@Injectable()
export class BillingApi implements IBillingApi {
  private readonly baseUri: string;
  private readonly authHeaders: Record<string, string>;
  private readonly requestTimeout: number;
  private readonly expireTimeSeconds: number;
  private readonly billingExpireTimeSeconds: number;
  private readonly notFoundExpireTimeSeconds: number;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
    @Inject(CacheService)
    private readonly cacheService: ICacheService,
    @Inject(LoggingService)
    private readonly loggingService: ILoggingService,
  ) {
    this.baseUri =
      this.configurationService.getOrThrow<string>('billing.baseUri');
    this.authHeaders = {
      Authorization: `Bearer ${this.configurationService.getOrThrow<string>(
        'billing.apiToken',
      )}`,
    };
    this.requestTimeout = this.configurationService.getOrThrow<number>(
      'billing.requestTimeout',
    );
    this.expireTimeSeconds = this.configurationService.getOrThrow<number>(
      'expirationTimeInSeconds.default',
    );
    this.billingExpireTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.billing',
      );
    this.notFoundExpireTimeSeconds =
      this.configurationService.getOrThrow<number>(
        'expirationTimeInSeconds.notFound.default',
      );
  }

  listPlans(): Promise<Array<Plan>> {
    return this.request({
      cacheDir: CacheRouter.getBillingPlansCacheDir(),
      url: `${this.baseUri}/api/v1/plans`,
      schema: z
        .object({ plans: z.array(PlanSchema) })
        .transform((body) => body.plans),
    });
  }

  getPlan(args: { planId: string }): Promise<Plan> {
    return this.request({
      cacheDir: CacheRouter.getBillingPlanCacheDir(args.planId),
      url: `${this.baseUri}/api/v1/plans/${args.planId}`,
      schema: PlanSchema,
    });
  }

  /**
   * Cached with a short, dedicated TTL rather than the default one: there is
   * no webhook-driven invalidation for customer changes yet, so this bounds
   * how long a change (e.g. a plan change) can stay stale.
   */
  getCustomer(args: { upstreamCustomerId: string }): Promise<Customer> {
    return this.request({
      cacheDir: CacheRouter.getBillingCustomerCacheDir(args.upstreamCustomerId),
      url: this.customerUrl(args.upstreamCustomerId),
      schema: z
        .object({ customer: CustomerSchema })
        .transform((body) => body.customer),
      expireTimeSeconds: this.billingExpireTimeSeconds,
    });
  }

  /** Not cached: this endpoint returns a fresh, single-use portal session URL on every call. */
  getCustomerSessionUrl(args: {
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<string> {
    const url = new URL(
      `${this.customerUrl(args.upstreamCustomerId)}/session-url`,
    );
    url.searchParams.set('returnUrl', args.returnUrl);

    return this.parse(
      this.networkService
        .get<string>({
          url: url.toString(),
          networkRequest: {
            headers: this.authHeaders,
            timeout: this.requestTimeout,
            responseType: 'text',
          },
        })
        .then(({ data }) => data),
      z.string(),
    );
  }

  /**
   * Cached with a short, dedicated TTL rather than the default one: there is
   * no webhook-driven invalidation for subscription changes yet, so this
   * bounds how long a status change (cancel/upgrade/renew) can stay stale.
   */
  getSubscriptionsByCustomerId(args: {
    upstreamCustomerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>> {
    return this.request({
      cacheDir: CacheRouter.getBillingSubscriptionsCacheDir({
        upstreamCustomerId: args.upstreamCustomerId,
        status: args.status ?? 'all',
      }),
      url: `${this.customerUrl(args.upstreamCustomerId)}/subscriptions`,
      params: args.status ? { status: args.status } : undefined,
      schema: z
        .object({ subscriptions: z.array(SubscriptionSchema) })
        .transform((body) => body.subscriptions),
      expireTimeSeconds: this.billingExpireTimeSeconds,
    });
  }

  listPaymentLinks(
    args: { upstreamCustomerId?: string } = {},
  ): Promise<Array<PaymentLink>> {
    return this.request({
      cacheDir: CacheRouter.getBillingPaymentLinksCacheDir(
        args.upstreamCustomerId,
      ),
      url: `${this.baseUri}/api/v1/payment-links`,
      params: args.upstreamCustomerId
        ? { customerId: stripDashes(args.upstreamCustomerId) }
        : undefined,
      schema: z
        .object({ paymentLinks: z.array(PaymentLinkSchema) })
        .transform((body) => body.paymentLinks),
    });
  }

  /** Not cached: this creates a new resource on every call. */
  createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<CheckoutSessionResult> {
    return this.parse(
      this.networkService
        .post<CheckoutSessionResult>({
          url: `${this.baseUri}/api/v1/payment-links/${args.paymentLinkId}/checkout`,
          data: {
            upstreamCustomerId: stripDashes(args.upstreamCustomerId),
            returnUrl: args.returnUrl,
          },
          networkRequest: {
            headers: this.authHeaders,
            timeout: this.requestTimeout,
          },
        })
        .then(({ data }) => data),
      CheckoutSessionResultSchema,
    );
  }

  /** Not cached: always fetches a fresh session (e.g. for post-payment polling). */
  getCheckoutSession(args: { sessionId: string }): Promise<CheckoutSession> {
    return this.parse(
      this.networkService
        .get<CheckoutSession>({
          url: `${this.baseUri}/api/v1/sessions/${args.sessionId}`,
          networkRequest: {
            headers: this.authHeaders,
            timeout: this.requestTimeout,
          },
        })
        .then(({ data }) => data),
      CheckoutSessionSchema,
    );
  }

  /** Not cached: a live proration quote, valid only for the moment it is asked. */
  previewSubscriptionUpdate(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
  }): Promise<SubscriptionUpdatePreview> {
    return this.parse(
      this.networkService
        .get<SubscriptionUpdatePreview>({
          url: `${this.subscriptionUrl(args)}/preview-update`,
          networkRequest: {
            headers: this.authHeaders,
            params: {
              planId: args.planId,
              prorationBehavior: DEFAULT_PRORATION_BEHAVIOR,
            },
            timeout: this.requestTimeout,
          },
        })
        .then(({ data }) => data),
      SubscriptionUpdatePreviewSchema,
    );
  }

  async updateSubscription(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
    planId: string;
    paymentLinkId: string;
  }): Promise<UpdateSubscriptionResult> {
    return await this.parse(
      this.networkService
        .patch<UpdateSubscriptionResult>({
          url: this.subscriptionUrl(args),
          data: {
            planId: args.planId,
            // The upstream copies this link's metadata onto the subscription,
            // and the entitlements are derived from that metadata.
            paymentLinkId: args.paymentLinkId,
            prorationBehavior: DEFAULT_PRORATION_BEHAVIOR,
          },
          networkRequest: {
            headers: this.authHeaders,
            timeout: this.requestTimeout,
          },
        })
        // Before parsing, not after: the change is applied whatever the body
        // turns out to be. Best-effort, so a cache failure cannot make the
        // client retry it — a retried change is a second proration.
        .then(async ({ data }) => {
          await this.clearSubscriptions(args).catch(() => {
            this.loggingService.warn(
              'Failed to clear the billing subscriptions cache after a plan change',
            );
          });
          return data;
        }),
      UpdateSubscriptionResultSchema,
    );
  }

  /** The whole key: the subscription may be listed under any cached filter. */
  async clearSubscriptions(args: {
    upstreamCustomerId: string;
  }): Promise<void> {
    await this.cacheService.deleteByKey(
      CacheRouter.getBillingSubscriptionsCacheKey(args.upstreamCustomerId),
    );
  }

  private customerUrl(upstreamCustomerId: string): string {
    return `${this.baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}`;
  }

  private subscriptionUrl(args: {
    upstreamCustomerId: string;
    subscriptionId: string;
  }): string {
    return `${this.customerUrl(args.upstreamCustomerId)}/subscriptions/${encodeURIComponent(args.subscriptionId)}`;
  }

  private request<T>(args: {
    cacheDir: CacheDir;
    url: string;
    params?: NetworkRequest['params'];
    schema: z.ZodType<T>;
    expireTimeSeconds?: number;
  }): Promise<T> {
    return this.parse(
      this.dataSource.get<T>({
        cacheDir: args.cacheDir,
        url: args.url,
        notFoundExpireTimeSeconds: this.notFoundExpireTimeSeconds,
        networkRequest: {
          headers: this.authHeaders,
          params: args.params,
          timeout: this.requestTimeout,
        },
        expireTimeSeconds: args.expireTimeSeconds ?? this.expireTimeSeconds,
      }),
      args.schema,
    );
  }

  private async parse<T>(
    data: Promise<unknown>,
    schema: z.ZodType<T>,
  ): Promise<T> {
    try {
      return schema.parse(await data);
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }
}
