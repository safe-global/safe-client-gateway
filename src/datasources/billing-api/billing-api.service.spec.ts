// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { BillingApi } from '@/datasources/billing-api/billing-api.service';
import {
  checkoutSessionBuilder,
  checkoutSessionResultBuilder,
} from '@/datasources/billing-api/entities/__tests__/checkout-session.builder';
import { customerBuilder } from '@/datasources/billing-api/entities/__tests__/customer.builder';
import { paymentLinkBuilder } from '@/datasources/billing-api/entities/__tests__/payment-link.builder';
import { planBuilder } from '@/datasources/billing-api/entities/__tests__/plan.builder';
import { subscriptionBuilder } from '@/datasources/billing-api/entities/__tests__/subscription.builder';
import { stripDashes } from '@/datasources/billing-api/upstream-customer-id.util';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { rawify } from '@/validation/entities/raw.entity';

const mockNetworkService = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<INetworkService>);

const mockDataSource = vi.mocked({
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<CacheFirstDataSource>);

describe('BillingApi', () => {
  let target: BillingApi;
  let fakeConfigurationService: FakeConfigurationService;
  let httpErrorFactory: HttpErrorFactory;
  let baseUri: string;
  let apiToken: string;
  let requestTimeout: number;
  let expireTimeSeconds: number;
  let billingExpireTimeSeconds: number;
  let notFoundExpireTimeSeconds: number;

  beforeEach(() => {
    vi.resetAllMocks();

    httpErrorFactory = new HttpErrorFactory();
    fakeConfigurationService = new FakeConfigurationService();
    baseUri = faker.internet.url({ appendSlash: false });
    apiToken = faker.string.alphanumeric(32);
    requestTimeout = faker.number.int({ min: 1000, max: 10_000 });
    expireTimeSeconds = faker.number.int({ min: 1, max: 100 });
    billingExpireTimeSeconds = faker.number.int({ min: 1, max: 100 });
    notFoundExpireTimeSeconds = faker.number.int({ min: 1, max: 100 });

    fakeConfigurationService.set('billing.baseUri', baseUri);
    fakeConfigurationService.set('billing.apiToken', apiToken);
    fakeConfigurationService.set('billing.requestTimeout', requestTimeout);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      expireTimeSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.billing',
      billingExpireTimeSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpireTimeSeconds,
    );

    target = new BillingApi(
      mockDataSource,
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
    );
  });

  function expectedGetCall(args: {
    cacheDir: CacheDir;
    url: string;
    params?: Record<string, string>;
    expireTimeSeconds?: number;
  }): unknown {
    return {
      cacheDir: args.cacheDir,
      url: args.url,
      notFoundExpireTimeSeconds,
      networkRequest: {
        headers: { Authorization: `Bearer ${apiToken}` },
        params: args.params,
        timeout: requestTimeout,
      },
      expireTimeSeconds: args.expireTimeSeconds ?? expireTimeSeconds,
    };
  }

  it('should error if baseUri is not defined', () => {
    const emptyConfigService = new FakeConfigurationService();

    expect(
      () =>
        new BillingApi(
          mockDataSource,
          mockNetworkService,
          emptyConfigService,
          httpErrorFactory,
        ),
    ).toThrow();
  });

  describe('listPlans', () => {
    it('should call the billing service API with correct URL, headers and cache dir', async () => {
      const plans = [planBuilder().build(), planBuilder().build()];
      mockDataSource.get.mockResolvedValueOnce(rawify({ plans }));

      const result = await target.listPlans();

      expect(result).toEqual(plans);
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir('billing_plans', ''),
          url: `${baseUri}/api/v1/plans`,
        }),
      );
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
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir(`${plan.id}_billing_plan`, ''),
          url: `${baseUri}/api/v1/plans/${plan.id}`,
        }),
      );
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
        upstreamCustomerId: customer.upstreamCustomerId,
      });

      expect(result).toEqual(customer);
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir(
            `${customer.upstreamCustomerId}_billing_customer`,
            '',
          ),
          url: `${baseUri}/api/v1/customers/${stripDashes(customer.upstreamCustomerId)}`,
          expireTimeSeconds: billingExpireTimeSeconds,
        }),
      );
    });

    it('should restore dashes in a hex-only upstreamCustomerId from the response', async () => {
      const customer = customerBuilder().build();
      mockDataSource.get.mockResolvedValueOnce(
        rawify({
          customer: {
            ...customer,
            upstreamCustomerId: stripDashes(customer.upstreamCustomerId),
          },
        }),
      );

      const result = await target.getCustomer({
        upstreamCustomerId: customer.upstreamCustomerId,
      });

      expect(result).toEqual(customer);
    });

    it('should forward a 401 as a DataSourceError', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/customers/${upstreamCustomerId}`),
        { status: 401 } as Response,
        { message: 'Token expired' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.getCustomer({ upstreamCustomerId })).rejects.toThrow(
        new DataSourceError('Token expired', 401),
      );
    });

    it('should forward network errors', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/customers/${upstreamCustomerId}`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.getCustomer({ upstreamCustomerId })).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });

  describe('getCustomerSessionUrl', () => {
    it('should call the billing service API with correct URL, headers and responseType, and return the plain-text body', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const returnUrl = faker.internet.url();
      const sessionUrl = faker.internet.url();
      mockNetworkService.get.mockResolvedValueOnce({
        data: rawify(sessionUrl),
        status: 200,
      });

      const result = await target.getCustomerSessionUrl({
        upstreamCustomerId,
        returnUrl,
      });

      expect(result).toEqual(sessionUrl);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}/session-url?returnUrl=${encodeURIComponent(returnUrl)}`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          timeout: requestTimeout,
          responseType: 'text',
        },
      });
    });

    it('should forward a 404 as a DataSourceError', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const url = new URL(
        `${baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}/session-url`,
      );
      mockNetworkService.get.mockRejectedValueOnce(
        new NetworkResponseError(
          url,
          new Response('Not found', { status: 404 }),
          'Not found',
        ),
      );

      await expect(
        target.getCustomerSessionUrl({
          upstreamCustomerId,
          returnUrl: faker.internet.url(),
        }),
      ).rejects.toThrow(new DataSourceError('An error occurred', 404));
    });

    it('should forward network errors', async () => {
      const upstreamCustomerId = faker.string.uuid();
      mockNetworkService.get.mockRejectedValueOnce(new Error('Timeout'));

      await expect(
        target.getCustomerSessionUrl({
          upstreamCustomerId,
          returnUrl: faker.internet.url(),
        }),
      ).rejects.toThrow(new DataSourceError('Service unavailable', 503));
    });
  });

  describe('getSubscriptionsByCustomerId', () => {
    it('should call the billing service API with correct URL, headers and cache dir', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const subscriptions = [
        subscriptionBuilder().build(),
        subscriptionBuilder().build(),
      ];
      mockDataSource.get.mockResolvedValueOnce(rawify({ subscriptions }));

      const result = await target.getSubscriptionsByCustomerId({
        upstreamCustomerId,
      });

      expect(result).toEqual(subscriptions);
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir(
            `${upstreamCustomerId}_billing_subscriptions`,
            'all',
          ),
          url: `${baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}/subscriptions`,
          expireTimeSeconds: billingExpireTimeSeconds,
        }),
      );
    });

    it('should restore dashes in a hex-only upstreamCustomerId from the response', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const subscription = subscriptionBuilder().build();
      mockDataSource.get.mockResolvedValueOnce(
        rawify({
          subscriptions: [
            {
              ...subscription,
              upstreamCustomerId: stripDashes(subscription.upstreamCustomerId),
            },
          ],
        }),
      );

      const result = await target.getSubscriptionsByCustomerId({
        upstreamCustomerId,
      });

      expect(result).toEqual([subscription]);
    });

    it('should accept a plan with absent name/description/billingCycle and a null originalPrice', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const subscription = subscriptionBuilder().build();
      const { name, description, billingCycle, ...planWithoutOptionals } =
        subscription.plan;
      const rawSubscription = {
        ...subscription,
        plan: { ...planWithoutOptionals, originalPrice: null },
      };
      mockDataSource.get.mockResolvedValueOnce(
        rawify({ subscriptions: [rawSubscription] }),
      );

      const result = await target.getSubscriptionsByCustomerId({
        upstreamCustomerId,
      });

      expect(result).toEqual([
        {
          ...subscription,
          plan: { ...planWithoutOptionals, originalPrice: null },
        },
      ]);
    });

    it('should forward the status filter as a query param and cache field', async () => {
      const upstreamCustomerId = faker.string.uuid();
      mockDataSource.get.mockResolvedValueOnce(rawify({ subscriptions: [] }));

      await target.getSubscriptionsByCustomerId({
        upstreamCustomerId,
        status: 'active',
      });

      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir(
            `${upstreamCustomerId}_billing_subscriptions`,
            'active',
          ),
          url: `${baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}/subscriptions`,
          params: { status: 'active' },
          expireTimeSeconds: billingExpireTimeSeconds,
        }),
      );
    });

    it('should forward the "all" status filter as a query param and cache field', async () => {
      const upstreamCustomerId = faker.string.uuid();
      mockDataSource.get.mockResolvedValueOnce(rawify({ subscriptions: [] }));

      await target.getSubscriptionsByCustomerId({
        upstreamCustomerId,
        status: 'all',
      });

      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir(
            `${upstreamCustomerId}_billing_subscriptions`,
            'all',
          ),
          url: `${baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}/subscriptions`,
          params: { status: 'all' },
          expireTimeSeconds: billingExpireTimeSeconds,
        }),
      );
    });

    it('should forward network errors', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(
          `${baseUri}/api/v1/customers/${stripDashes(upstreamCustomerId)}/subscriptions`,
        ),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(
        target.getSubscriptionsByCustomerId({ upstreamCustomerId }),
      ).rejects.toThrow(new DataSourceError('Internal server error', status));
    });
  });

  describe('listPaymentLinks', () => {
    it('should call the billing service API with correct URL, headers and cache dir (no upstreamCustomerId)', async () => {
      const paymentLinks = [
        paymentLinkBuilder().build(),
        paymentLinkBuilder().build(),
      ];
      mockDataSource.get.mockResolvedValueOnce(rawify({ paymentLinks }));

      const result = await target.listPaymentLinks();

      expect(result).toEqual(paymentLinks);
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir('billing_payment_links', ''),
          url: `${baseUri}/api/v1/payment-links`,
        }),
      );
    });

    it('should forward upstreamCustomerId as the customerId query param and cache dir', async () => {
      const upstreamCustomerId = faker.string.uuid();
      const paymentLinks = [paymentLinkBuilder().build()];
      mockDataSource.get.mockResolvedValueOnce(rawify({ paymentLinks }));

      const result = await target.listPaymentLinks({ upstreamCustomerId });

      expect(result).toEqual(paymentLinks);
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expectedGetCall({
          cacheDir: new CacheDir('billing_payment_links', upstreamCustomerId),
          url: `${baseUri}/api/v1/payment-links`,
          params: { customerId: stripDashes(upstreamCustomerId) },
        }),
      );
    });

    it('should throw a ZodError on a malformed response', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify({ paymentLinks: [{ malformed: true }] }),
      );

      await expect(target.listPaymentLinks()).rejects.toThrow();
    });

    it('should forward network errors', async () => {
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/payment-links`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockDataSource.get.mockRejectedValueOnce(error);

      await expect(target.listPaymentLinks()).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });

  describe('createCheckoutSession', () => {
    it('should call the billing service API with correct URL, headers and body', async () => {
      const paymentLinkId = faker.string.uuid();
      const upstreamCustomerId = faker.string.uuid();
      const returnUrl = faker.internet.url();
      const checkoutSessionResult = checkoutSessionResultBuilder().build();
      mockNetworkService.post.mockResolvedValueOnce({
        status: 201,
        data: rawify(checkoutSessionResult),
      });

      const result = await target.createCheckoutSession({
        paymentLinkId,
        upstreamCustomerId,
        returnUrl,
      });

      expect(result).toEqual(checkoutSessionResult);
      expect(mockNetworkService.post).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/payment-links/${paymentLinkId}/checkout`,
        data: {
          upstreamCustomerId: stripDashes(upstreamCustomerId),
          returnUrl,
        },
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          timeout: requestTimeout,
        },
      });
      expect(mockDataSource.post).not.toHaveBeenCalled();
    });

    it('should throw a ZodError on a malformed response', async () => {
      mockNetworkService.post.mockResolvedValueOnce({
        status: 201,
        data: rawify({ malformed: true }),
      });

      await expect(
        target.createCheckoutSession({
          paymentLinkId: faker.string.uuid(),
          upstreamCustomerId: faker.string.uuid(),
          returnUrl: faker.internet.url(),
        }),
      ).rejects.toThrow();
    });

    it('should forward network errors', async () => {
      const paymentLinkId = faker.string.uuid();
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/payment-links/${paymentLinkId}/checkout`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockNetworkService.post.mockRejectedValueOnce(error);

      await expect(
        target.createCheckoutSession({
          paymentLinkId,
          upstreamCustomerId: faker.string.uuid(),
          returnUrl: faker.internet.url(),
        }),
      ).rejects.toThrow(new DataSourceError('Internal server error', status));
    });
  });

  describe('getCheckoutSession', () => {
    it('should call the billing service API with correct URL and headers', async () => {
      const sessionId = faker.string.alphanumeric(32);
      const checkoutSession = checkoutSessionBuilder().build();
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(checkoutSession),
      });

      const result = await target.getCheckoutSession({ sessionId });

      expect(result).toEqual(checkoutSession);
      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${baseUri}/api/v1/sessions/${sessionId}`,
        networkRequest: {
          headers: { Authorization: `Bearer ${apiToken}` },
          timeout: requestTimeout,
        },
      });
      expect(mockDataSource.get).not.toHaveBeenCalled();
    });

    it('should accept null client_reference_id, subscription, invoice and customer', async () => {
      const sessionId = faker.string.alphanumeric(32);
      const checkoutSession = checkoutSessionBuilder().build();
      const rawSession = {
        ...checkoutSession,
        client_reference_id: null,
        customer: null,
        subscription: null,
        invoice: null,
      };
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify(rawSession),
      });

      const result = await target.getCheckoutSession({ sessionId });

      expect(result).toEqual({
        ...checkoutSession,
        client_reference_id: null,
        customer: null,
        subscription: null,
        invoice: null,
      });
    });

    it('should throw a ZodError on a malformed response', async () => {
      mockNetworkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ malformed: true }),
      });

      await expect(
        target.getCheckoutSession({ sessionId: faker.string.uuid() }),
      ).rejects.toThrow();
    });

    it('should forward network errors', async () => {
      const sessionId = faker.string.alphanumeric(32);
      const status = faker.internet.httpStatusCode({ types: ['serverError'] });
      const error = new NetworkResponseError(
        new URL(`${baseUri}/api/v1/sessions/${sessionId}`),
        { status } as Response,
        { message: 'Internal server error' },
      );
      mockNetworkService.get.mockRejectedValueOnce(error);

      await expect(target.getCheckoutSession({ sessionId })).rejects.toThrow(
        new DataSourceError('Internal server error', status),
      );
    });
  });
});
