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
import { stripDashes } from '@/datasources/billing-api/upstream-customer-id.util';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { IBillingApi } from '@/domain/interfaces/billing-api.interface';

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
      url: `${this.baseUri}/api/v1/customers/${stripDashes(args.upstreamCustomerId)}`,
      schema: z
        .object({ customer: CustomerSchema })
        .transform((body) => body.customer),
      expireTimeSeconds: this.billingExpireTimeSeconds,
    });
  }

  /** Not cached. Bypasses {@link NetworkService}, whose response.json() parsing can't handle this endpoint's plain-text body. */
  async getCustomerSessionUrl(args: {
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<string> {
    const url = new URL(
      `${this.baseUri}/api/v1/customers/${stripDashes(args.upstreamCustomerId)}/session-url`,
    );
    url.searchParams.set('returnUrl', args.returnUrl);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: this.authHeaders,
        signal: AbortSignal.timeout(this.requestTimeout),
      });
    } catch (error) {
      throw this.httpErrorFactory.from(error);
    }

    if (!response.ok) {
      const data = await response.text().catch(() => undefined);
      throw this.httpErrorFactory.from(
        new NetworkResponseError(url, response, data),
      );
    }

    return response.text();
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
      url: `${this.baseUri}/api/v1/customers/${stripDashes(args.upstreamCustomerId)}/subscriptions`,
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
