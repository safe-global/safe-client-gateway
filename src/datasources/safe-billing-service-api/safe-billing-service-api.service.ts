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

  getCustomer(args: { customerId: string }): Promise<Customer> {
    return this.request({
      cacheDir: CacheRouter.getSafeBillingCustomerCacheDir(args.customerId),
      url: `${this.baseUri}/api/v1/customers/${args.customerId}`,
      schema: z
        .object({ customer: CustomerSchema })
        .transform((body) => body.customer),
    });
  }

  getSubscriptionsByCustomerId(args: {
    customerId: string;
    status?: SubscriptionStatusFilter;
  }): Promise<Array<Subscription>> {
    return this.request({
      cacheDir: CacheRouter.getSafeBillingSubscriptionsCacheDir(
        args.customerId,
        args.status ?? 'all',
      ),
      url: `${this.baseUri}/api/v1/customers/${args.customerId}/subscriptions`,
      params: args.status ? { status: args.status } : undefined,
      schema: z
        .object({ subscriptions: z.array(SubscriptionSchema) })
        .transform((body) => body.subscriptions),
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
    return this.requestUncached({
      method: 'post',
      url: `${this.baseUri}/api/v1/payment-links/${args.paymentLinkId}/checkout`,
      data: {
        upstreamCustomerId: args.upstreamCustomerId,
        returnUrl: args.returnUrl,
      },
      schema: CheckoutSessionSchema,
    });
  }

  getCheckoutSession(args: { sessionId: string }): Promise<CheckoutSession> {
    return this.requestUncached({
      method: 'get',
      url: `${this.baseUri}/api/v1/sessions/${args.sessionId}`,
      schema: CheckoutSessionSchema,
    });
  }

  private async request<T>(args: {
    cacheDir: CacheDir;
    url: string;
    params?: NetworkRequest['params'];
    schema: z.ZodType<T>;
  }): Promise<T> {
    try {
      const data = await this.dataSource.get<unknown>({
        cacheDir: args.cacheDir,
        url: args.url,
        notFoundExpireTimeSeconds: this.notFoundExpireTimeSeconds,
        networkRequest: {
          headers: this.authHeaders,
          params: args.params,
          timeout: this.requestTimeout,
        },
        expireTimeSeconds: this.expireTimeSeconds,
      });
      return args.schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }

  /**
   * Issues a request that bypasses the cache entirely, for endpoints that
   * mutate state (checkout session creation) or that must always return
   * fresh data (checkout session polling).
   */
  private async requestUncached<T>(args: {
    method: 'get' | 'post';
    url: string;
    data?: object;
    schema: z.ZodType<T>;
  }): Promise<T> {
    try {
      const networkRequest = {
        headers: this.authHeaders,
        timeout: this.requestTimeout,
      };
      const { data } =
        args.method === 'post'
          ? await this.networkService.post<unknown>({
              url: args.url,
              data: args.data,
              networkRequest,
            })
          : await this.networkService.get<unknown>({
              url: args.url,
              networkRequest,
            });
      return args.schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }
}
