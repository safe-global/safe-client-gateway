// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { customerBuilder } from '@/datasources/safe-billing-service-api/entities/__tests__/customer.builder';
import { planBuilder } from '@/datasources/safe-billing-service-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/safe-billing-service-api/entities/__tests__/subscription.builder';
import { SafeBillingServiceApi } from '@/datasources/safe-billing-service-api/safe-billing-service-api.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify } from '@/validation/entities/raw.entity';

const mockNetworkService = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<INetworkService>);

describe('SafeBillingServiceApi', () => {
  let target: SafeBillingServiceApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;
  let baseUri: string;
  let apiToken: string;
  let requestTimeout: number;

  beforeEach(() => {
    vi.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });
    apiToken = faker.string.alphanumeric(32);
    requestTimeout = faker.number.int({ min: 1000, max: 10_000 });

    fakeConfigurationService.set('safeBillingService.baseUri', baseUri);
    fakeConfigurationService.set('safeBillingService.apiToken', apiToken);
    fakeConfigurationService.set(
      'safeBillingService.requestTimeout',
      requestTimeout,
    );

    target = new SafeBillingServiceApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
    );
  });

  it('should error if baseUri is not defined', () => {
    const emptyConfigService = new FakeConfigurationService();

    expect(
      () =>
        new SafeBillingServiceApi(
          mockNetworkService,
          emptyConfigService,
          new HttpErrorFactory(),
        ),
    ).toThrow();
  });

  describe('listPlans', () => {
    it('should call the billing service API with correct URL and headers', async () => {
      const plans = [planBuilder().build(), planBuilder().build()];
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ plans }),
      });

      const result = await target.listPlans();

      expect(result).toEqual(plans);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/plans`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          timeout: requestTimeout,
        },
      });
    });

    it('should forward network errors', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/plans`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.listPlans()).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });

    it('should throw a ZodError on a malformed response', async () => {
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ plans: [{ malformed: true }] }),
      });

      await expect(target.listPlans()).rejects.toThrow();
    });
  });

  describe('getPlan', () => {
    it('should call the billing service API with correct URL and headers', async () => {
      const plan = planBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(plan),
      });

      const result = await target.getPlan({ planId: plan.id });

      expect(result).toEqual(plan);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/plans/${plan.id}`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          timeout: requestTimeout,
        },
      });
    });

    it('should forward a 401 as a DataSourceError', async () => {
      const planId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/plans/${planId}`),
        { status: 401 } as Response,
        { message: 'Token expired' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.getPlan({ planId })).rejects.toThrow(
        new DataSourceError('Token expired', 401),
      );
    });
  });

  describe('getCustomer', () => {
    it('should call the billing service API with correct URL and headers', async () => {
      const customer = customerBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ customer }),
      });

      const result = await target.getCustomer({
        customerId: customer.upstreamCustomerId,
      });

      expect(result).toEqual(customer);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/customers/${customer.upstreamCustomerId}`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          timeout: requestTimeout,
        },
      });
    });

    it('should forward a 401 as a DataSourceError', async () => {
      const customerId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/customers/${customerId}`),
        { status: 401 } as Response,
        { message: 'Token expired' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.getCustomer({ customerId })).rejects.toThrow(
        new DataSourceError('Token expired', 401),
      );
    });

    it('should forward network errors', async () => {
      const customerId = faker.string.uuid();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/customers/${customerId}`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.getCustomer({ customerId })).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });

  describe('getSubscriptionsByCustomerId', () => {
    it('should call the billing service API with correct URL and headers', async () => {
      const customerId = faker.string.uuid();
      const subscriptions = [
        subscriptionBuilder().build(),
        subscriptionBuilder().build(),
      ];
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ subscriptions }),
      });

      const result = await target.getSubscriptionsByCustomerId({
        customerId,
      });

      expect(result).toEqual(subscriptions);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/customers/${customerId}/subscriptions`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: undefined,
          timeout: requestTimeout,
        },
      });
    });

    it('should forward the status filter as a query param', async () => {
      const customerId = faker.string.uuid();
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ subscriptions: [] }),
      });

      await target.getSubscriptionsByCustomerId({
        customerId,
        status: 'active',
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/customers/${customerId}/subscriptions`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: { status: 'active' },
          timeout: requestTimeout,
        },
      });
    });

    it('should forward network errors', async () => {
      const customerId = faker.string.uuid();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/customers/${customerId}/subscriptions`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(
        target.getSubscriptionsByCustomerId({ customerId }),
      ).rejects.toThrow(new DataSourceError('Internal server error', status));
    });
  });
});
