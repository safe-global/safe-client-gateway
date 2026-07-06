// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import { customerBuilder } from '@/datasources/safe-billing-service-api/entities/__tests__/customer.builder';
import { planBuilder } from '@/datasources/safe-billing-service-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/safe-billing-service-api/entities/__tests__/subscription.builder';
import { SafeBillingServiceApi } from '@/datasources/safe-billing-service-api/safe-billing-service-api.service';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify } from '@/validation/entities/raw.entity';

const mockDataSource = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<CacheFirstDataSource>);

describe('SafeBillingServiceApi', () => {
  let target: SafeBillingServiceApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;
  let baseUri: string;
  let apiToken: string;
  let requestTimeout: number;
  let expireTimeSeconds: number;
  let notFoundExpireTimeSeconds: number;

  beforeEach(() => {
    vi.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });
    apiToken = faker.string.alphanumeric(32);
    requestTimeout = faker.number.int({ min: 1000, max: 10_000 });
    expireTimeSeconds = faker.number.int({ min: 1, max: 100 });
    notFoundExpireTimeSeconds = faker.number.int({ min: 1, max: 100 });

    fakeConfigurationService.set('safeBillingService.baseUri', baseUri);
    fakeConfigurationService.set('safeBillingService.apiToken', apiToken);
    fakeConfigurationService.set(
      'safeBillingService.requestTimeout',
      requestTimeout,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      expireTimeSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpireTimeSeconds,
    );

    target = new SafeBillingServiceApi(
      mockDataSource,
      fakeConfigurationService,
      httpErrorFactory,
    );
  });

  it('should error if baseUri is not defined', () => {
    const emptyConfigService = new FakeConfigurationService();

    expect(
      () =>
        new SafeBillingServiceApi(
          mockDataSource,
          emptyConfigService,
          new HttpErrorFactory(),
        ),
    ).toThrow();
  });

  describe('listPlans', () => {
    it('should call the billing service API with correct URL, headers and cache dir', async () => {
      const plans = [planBuilder().build(), planBuilder().build()];
      mockDataSource.get.mockResolvedValueOnce(rawify({ plans }));

      const result = await target.listPlans();

      expect(result).toEqual(plans);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: new CacheDir('safe_billing_plans', ''),
        url: `${baseUri}/api/v1/plans`,
        notFoundExpireTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: undefined,
          timeout: requestTimeout,
        },
        expireTimeSeconds,
      });
    });

    it('should forward network errors', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/plans`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.listPlans()).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });

    it('should throw a ZodError on a malformed response', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify({ plans: [{ malformed: true }] }),
      );

      await expect(target.listPlans()).rejects.toThrow();
    });
  });

  describe('getPlan', () => {
    it('should call the billing service API with correct URL, headers and cache dir', async () => {
      const plan = planBuilder().build();
      mockDataSource.get.mockResolvedValueOnce(rawify(plan));

      const result = await target.getPlan({ planId: plan.id });

      expect(result).toEqual(plan);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: new CacheDir(`${plan.id}_safe_billing_plan`, ''),
        url: `${baseUri}/api/v1/plans/${plan.id}`,
        notFoundExpireTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: undefined,
          timeout: requestTimeout,
        },
        expireTimeSeconds,
      });
    });

    it('should forward a 401 as a DataSourceError', async () => {
      const planId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/plans/${planId}`),
        { status: 401 } as Response,
        { message: 'Token expired' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.getPlan({ planId })).rejects.toThrow(
        new DataSourceError('Token expired', 401),
      );
    });

    it('should forward network errors', async () => {
      const planId = faker.string.uuid();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/plans/${planId}`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.getPlan({ planId })).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });

  describe('getCustomer', () => {
    it('should call the billing service API with correct URL, headers and cache dir', async () => {
      const customer = customerBuilder().build();
      mockDataSource.get.mockResolvedValueOnce(rawify({ customer }));

      const result = await target.getCustomer({
        customerId: customer.upstreamCustomerId,
      });

      expect(result).toEqual(customer);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: new CacheDir(
          `${customer.upstreamCustomerId}_safe_billing_customer`,
          '',
        ),
        url: `${baseUri}/api/v1/customers/${customer.upstreamCustomerId}`,
        notFoundExpireTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: undefined,
          timeout: requestTimeout,
        },
        expireTimeSeconds,
      });
    });

    it('should forward a 401 as a DataSourceError', async () => {
      const customerId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/customers/${customerId}`),
        { status: 401 } as Response,
        { message: 'Token expired' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

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
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.getCustomer({ customerId })).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });

  describe('getSubscriptionsByCustomerId', () => {
    it('should call the billing service API with correct URL, headers and cache dir', async () => {
      const customerId = faker.string.uuid();
      const subscriptions = [
        subscriptionBuilder().build(),
        subscriptionBuilder().build(),
      ];
      mockDataSource.get.mockResolvedValueOnce(rawify({ subscriptions }));

      const result = await target.getSubscriptionsByCustomerId({
        customerId,
      });

      expect(result).toEqual(subscriptions);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: new CacheDir(
          `${customerId}_safe_billing_subscriptions`,
          'all',
        ),
        url: `${baseUri}/api/v1/customers/${customerId}/subscriptions`,
        notFoundExpireTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: undefined,
          timeout: requestTimeout,
        },
        expireTimeSeconds,
      });
    });

    it('should forward the status filter as a query param and cache field', async () => {
      const customerId = faker.string.uuid();
      mockDataSource.get.mockResolvedValueOnce(rawify({ subscriptions: [] }));

      await target.getSubscriptionsByCustomerId({
        customerId,
        status: 'active',
      });

      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: new CacheDir(
          `${customerId}_safe_billing_subscriptions`,
          'active',
        ),
        url: `${baseUri}/api/v1/customers/${customerId}/subscriptions`,
        notFoundExpireTimeSeconds,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          params: { status: 'active' },
          timeout: requestTimeout,
        },
        expireTimeSeconds,
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
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(
        target.getSubscriptionsByCustomerId({ customerId }),
      ).rejects.toThrow(new DataSourceError('Internal server error', status));
    });
  });
});
