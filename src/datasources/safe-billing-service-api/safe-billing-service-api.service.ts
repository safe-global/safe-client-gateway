// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import { ZodError, z } from 'zod';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import {
  type INetworkService,
  NetworkService,
} from '@/datasources/network/network.service.interface';
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

  constructor(
    @Inject(NetworkService)
    private readonly networkService: INetworkService,
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
  }

  async listPlans(): Promise<Array<Plan>> {
    try {
      const url = `${this.baseUri}/api/v1/plans`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          headers: this.authHeaders(),
          timeout: this.requestTimeout,
        },
      });
      return z.object({ plans: z.array(PlanSchema) }).parse(data).plans;
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }

  async getPlan(args: { planId: string }): Promise<Plan> {
    try {
      const url = `${this.baseUri}/api/v1/plans/${args.planId}`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          headers: this.authHeaders(),
          timeout: this.requestTimeout,
        },
      });
      return PlanSchema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }

  async getCustomer(args: { customerId: string }): Promise<Customer> {
    try {
      const url = `${this.baseUri}/api/v1/customers/${args.customerId}`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          headers: this.authHeaders(),
          timeout: this.requestTimeout,
        },
      });
      return z.object({ customer: CustomerSchema }).parse(data).customer;
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }

  async getSubscriptionsByCustomerId(args: {
    customerId: string;
    status?: SubscriptionStatus | 'all';
  }): Promise<Array<Subscription>> {
    try {
      const url = `${this.baseUri}/api/v1/customers/${args.customerId}/subscriptions`;
      const { data } = await this.networkService.get<unknown>({
        url,
        networkRequest: {
          headers: this.authHeaders(),
          params: args.status ? { status: args.status } : undefined,
          timeout: this.requestTimeout,
        },
      });
      return z
        .object({ subscriptions: z.array(SubscriptionSchema) })
        .parse(data).subscriptions;
    } catch (error) {
      if (error instanceof ZodError) throw error;
      throw this.httpErrorFactory.from(error);
    }
  }

  private authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${this.apiToken}` };
  }
}
