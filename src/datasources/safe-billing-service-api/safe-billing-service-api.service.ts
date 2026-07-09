// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ZodError, z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
import type { CheckoutSession } from '@/datasources/safe-billing-service-api/entities/checkout-session.entity';
import { CheckoutSessionSchema } from '@/datasources/safe-billing-service-api/entities/checkout-session.entity';
import type { Customer } from '@/datasources/safe-billing-service-api/entities/customer.entity';
import { CustomerSchema } from '@/datasources/safe-billing-service-api/entities/customer.entity';
import type { PaymentLink } from '@/datasources/safe-billing-service-api/entities/payment-link.entity';
import { PaymentLinkSchema } from '@/datasources/safe-billing-service-api/entities/payment-link.entity';
import type { Plan } from '@/datasources/safe-billing-service-api/entities/plan.entity';
import { PlanSchema } from '@/datasources/safe-billing-service-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatusFilter,
} from '@/datasources/safe-billing-service-api/entities/subscription.entity';
import { SubscriptionSchema } from '@/datasources/safe-billing-service-api/entities/subscription.entity';
import type { ISafeBillingServiceApi } from '@/domain/interfaces/safe-billing-service-api.interface';

@Injectable()
export class SafeBillingServiceApi implements ISafeBillingServiceApi {
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
    this.baseUri = this.configurationService.getOrThrow<string>(
      'safeBillingService.baseUri',
    );
    this.authHeaders = {
      Authorization: `Bearer ${this.configurationService.getOrThrow<string>(
        'safeBillingService.apiToken',
      )}`,
    };
    this.requestTimeout = this.configurationService.getOrThrow<number>(
      'safeBillingService.requestTimeout',
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
      cacheDir: CacheRouter.getSafeBillingPlansCacheDir(),
      url: `${this.baseUri}/api/v1/plans`,
      schema: z
        .object({ plans: z.array(PlanSchema) })
        .transform((body) => body.plans),
    });
  }

  getPlan(args: { planId: string }): Promise<Plan> {
    return this.request({
      cacheDir: CacheRouter.getSafeBillingPlanCacheDir(args.planId),
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
      cacheDir: CacheRouter.getSafeBillingCustomerCacheDir(
        args.upstreamCustomerId,
      ),
      url: `${this.baseUri}/api/v1/customers/${args.upstreamCustomerId}`,
      schema: z
        .object({ customer: CustomerSchema })
        .transform((body) => body.customer),
      expireTimeSeconds: this.billingExpireTimeSeconds,
    });
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
      cacheDir: CacheRouter.getSafeBillingSubscriptionsCacheDir({
        upstreamCustomerId: args.upstreamCustomerId,
        status: args.status ?? 'all',
      }),
      url: `${this.baseUri}/api/v1/customers/${args.upstreamCustomerId}/subscriptions`,
      params: args.status ? { status: args.status } : undefined,
      schema: z
        .object({ subscriptions: z.array(SubscriptionSchema) })
        .transform((body) => body.subscriptions),
      expireTimeSeconds: this.billingExpireTimeSeconds,
    });
  }

  listPaymentLinks(args?: {
    customerId?: string;
  }): Promise<Array<PaymentLink>> {
    return this.request({
      cacheDir: CacheRouter.getSafeBillingPaymentLinksCacheDir(
        args?.customerId,
      ),
      url: `${this.baseUri}/api/v1/payment-links`,
      params: args?.customerId ? { customerId: args.customerId } : undefined,
      schema: z
        .object({ paymentLinks: z.array(PaymentLinkSchema) })
        .transform((body) => body.paymentLinks),
    });
  }

  createCheckoutSession(args: {
    paymentLinkId: string;
    upstreamCustomerId: string;
    returnUrl: string;
  }): Promise<CheckoutSession> {
    return this.postUncached({
      url: `${this.baseUri}/api/v1/payment-links/${args.paymentLinkId}/checkout`,
      data: {
        upstreamCustomerId: args.upstreamCustomerId,
        returnUrl: args.returnUrl,
      },
      schema: CheckoutSessionSchema,
    });
  }

  getCheckoutSession(args: { sessionId: string }): Promise<CheckoutSession> {
    return this.getUncached({
      url: `${this.baseUri}/api/v1/sessions/${args.sessionId}`,
      schema: CheckoutSessionSchema,
    });
  }

  private request<T>(args: {
    cacheDir: CacheDir;
    url: string;
    params?: NetworkRequest['params'];
    schema: z.ZodType<T>;
    expireTimeSeconds?: number;
  }): Promise<T> {
    return this.parse(
      this.dataSource.get<unknown>({
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

  /**
   * Issues a GET request that bypasses the cache entirely, for endpoints
   * that must always return fresh data (checkout session polling).
   */
  private getUncached<T>(args: {
    url: string;
    schema: z.ZodType<T>;
  }): Promise<T> {
    return this.parse(
      this.networkService
        .get<unknown>({
          url: args.url,
          networkRequest: {
            headers: this.authHeaders,
            timeout: this.requestTimeout,
          },
        })
        .then(({ data }) => data),
      args.schema,
    );
  }

  /**
   * Issues a POST request that bypasses the cache entirely, for endpoints
   * that mutate state (checkout session creation).
   */
  private postUncached<T>(args: {
    url: string;
    data?: object;
    schema: z.ZodType<T>;
  }): Promise<T> {
    return this.parse(
      this.networkService
        .post<unknown>({
          url: args.url,
          data: args.data,
          networkRequest: {
            headers: this.authHeaders,
            timeout: this.requestTimeout,
          },
        })
        .then(({ data }) => data),
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
