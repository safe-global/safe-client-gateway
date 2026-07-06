// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ZodError, z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { NetworkRequest } from '@/datasources/network/entities/network.request.entity';
import type { Customer } from '@/datasources/safe-billing-service-api/entities/customer.entity';
import { CustomerSchema } from '@/datasources/safe-billing-service-api/entities/customer.entity';
import type { Plan } from '@/datasources/safe-billing-service-api/entities/plan.entity';
import { PlanSchema } from '@/datasources/safe-billing-service-api/entities/plan.entity';
import type {
  Subscription,
  SubscriptionStatus,
} from '@/datasources/safe-billing-service-api/entities/subscription.entity';
import { SubscriptionSchema } from '@/datasources/safe-billing-service-api/entities/subscription.entity';
import type { ISafeBillingServiceApi } from '@/domain/interfaces/safe-billing-service-api.interface';

@Injectable()
export class SafeBillingServiceApi implements ISafeBillingServiceApi {
  private readonly baseUri: string;
  private readonly apiToken: string;
  private readonly requestTimeout: number;
  private readonly expireTimeSeconds: number;
  private readonly notFoundExpireTimeSeconds: number;

  constructor(
    private readonly dataSource: CacheFirstDataSource,
    @Inject(IConfigurationService)
    private readonly configurationService: IConfigurationService,
    private readonly httpErrorFactory: HttpErrorFactory,
  ) {
    this.baseUri = this.configurationService.getOrThrow<string>(
      'safeBillingService.baseUri',
    );
    this.apiToken = this.configurationService.getOrThrow<string>(
      'safeBillingService.apiToken',
    );
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
    status?: SubscriptionStatus | 'all';
  }): Promise<Array<Subscription>> {
    return this.request({
      cacheDir: CacheRouter.getSafeBillingSubscriptionsCacheDir(args),
      url: `${this.baseUri}/api/v1/customers/${args.customerId}/subscriptions`,
      params: args.status ? { status: args.status } : undefined,
      schema: z
        .object({ subscriptions: z.array(SubscriptionSchema) })
        .transform((body) => body.subscriptions),
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
          headers: this.authHeaders(),
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

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiToken}` };
  }
}
