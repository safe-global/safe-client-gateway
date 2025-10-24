import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionChartApi } from '@/datasources/charts-api/zerion-chart-api.service';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { NetworkResponse } from '@/datasources/network/entities/network.response.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { zerionChartResponseBuilder } from '@/datasources/charts-api/entities/__tests__/zerion-chart.entity.builder';
import { faker } from '@faker-js/faker';
import { rawify } from '@/validation/entities/raw.entity';
import { ZodError } from 'zod';

const mockNetworkService = {
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

describe('ZerionChartApi', () => {
  let service: ZerionChartApi;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const zerionApiKey = faker.string.alphanumeric(32);
  const httpErrorFactory = new HttpErrorFactory();

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.baseUri',
      zerionBaseUri,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.apiKey',
      zerionApiKey,
    );
    fakeConfigurationService.set('balances.providers.zerion.currencies', [
      'usd',
      'eur',
      'gbp',
    ]);

    service = new ZerionChartApi(
      mockNetworkService,
      fakeConfigurationService,
      httpErrorFactory,
    );
  });

  describe('constructor', () => {
    it('should throw if baseUri is not configured', () => {
      const configService = new FakeConfigurationService();
      configService.set('balances.providers.zerion.currencies', ['usd']);

      expect(
        () =>
          new ZerionChartApi(
            mockNetworkService,
            configService,
            httpErrorFactory,
          ),
      ).toThrow();
    });

    it('should throw if currencies are not configured', () => {
      const configService = new FakeConfigurationService();
      configService.set('balances.providers.zerion.baseUri', zerionBaseUri);

      expect(
        () =>
          new ZerionChartApi(
            mockNetworkService,
            configService,
            httpErrorFactory,
          ),
      ).toThrow();
    });

    it('should initialize without apiKey if not configured', () => {
      const configService = new FakeConfigurationService();
      configService.set('balances.providers.zerion.baseUri', zerionBaseUri);
      configService.set('balances.providers.zerion.currencies', ['usd']);

      expect(
        () =>
          new ZerionChartApi(
            mockNetworkService,
            configService,
            httpErrorFactory,
          ),
      ).not.toThrow();
    });
  });

  describe('getChart', () => {
    it('should successfully fetch chart data', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const zerionResponse = zerionChartResponseBuilder().build();

      mockNetworkService.get.mockResolvedValue({
        data: rawify(zerionResponse),
        status: 200,
      } as unknown as NetworkResponse<unknown>);

      const result = await service.getChart({ fungibleId, period, currency });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/fungibles/${fungibleId}/charts/${period}`,
        networkRequest: {
          headers: { Authorization: `Basic ${zerionApiKey}` },
          params: { currency: 'usd' },
        },
      });

      expect(result).toEqual({
        beginAt: zerionResponse.data.attributes.begin_at,
        endAt: zerionResponse.data.attributes.end_at,
        stats: zerionResponse.data.attributes.stats,
        points: zerionResponse.data.attributes.points,
      });
    });

    it('should fetch chart data without Authorization header if apiKey is not set', async () => {
      const configService = new FakeConfigurationService();
      configService.set('balances.providers.zerion.baseUri', zerionBaseUri);
      configService.set('balances.providers.zerion.currencies', ['usd']);
      // No apiKey set

      const serviceWithoutKey = new ZerionChartApi(
        mockNetworkService,
        configService,
        httpErrorFactory,
      );

      const fungibleId = 'eth';
      const period = ChartPeriod.HOUR;
      const currency = 'usd';
      const zerionResponse = zerionChartResponseBuilder().build();

      mockNetworkService.get.mockResolvedValue({
        data: rawify(zerionResponse),
        status: 200,
      } as unknown as NetworkResponse<unknown>);

      await serviceWithoutKey.getChart({ fungibleId, period, currency });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/fungibles/${fungibleId}/charts/${period}`,
        networkRequest: {
          params: { currency: 'usd' },
          // No headers with Authorization
        },
      });
    });

    it('should work with all supported chart periods', async () => {
      const periods = [
        ChartPeriod.HOUR,
        ChartPeriod.DAY,
        ChartPeriod.WEEK,
        ChartPeriod.MONTH,
        ChartPeriod.THREE_MONTHS,
        ChartPeriod.YEAR,
        ChartPeriod.MAX,
      ];

      for (const period of periods) {
        const zerionResponse = zerionChartResponseBuilder().build();
        mockNetworkService.get.mockResolvedValue({
          data: rawify(zerionResponse),
          status: 200,
        } as unknown as NetworkResponse<unknown>);

        await service.getChart({
          fungibleId: 'eth',
          period,
          currency: 'usd',
        });

        expect(mockNetworkService.get).toHaveBeenCalledWith(
          expect.objectContaining({
            url: `${zerionBaseUri}/v1/fungibles/eth/charts/${period}`,
          }),
        );
      }
    });

    it('should lowercase currency in request params', async () => {
      const fungibleId = 'btc';
      const period = ChartPeriod.WEEK;
      const currency = 'USD'; // uppercase input
      const zerionResponse = zerionChartResponseBuilder().build();

      mockNetworkService.get.mockResolvedValue({
        data: rawify(zerionResponse),
        status: 200,
      } as unknown as NetworkResponse<unknown>);

      await service.getChart({ fungibleId, period, currency });

      expect(mockNetworkService.get).toHaveBeenCalledWith(
        expect.objectContaining({
          networkRequest: expect.objectContaining({
            params: { currency: 'usd' }, // lowercase in params
          }),
        }),
      );
    });

    it('should throw DataSourceError for unsupported currency', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'jpy'; // not in configured currencies

      await expect(
        service.getChart({ fungibleId, period, currency }),
      ).rejects.toThrow(DataSourceError);

      await expect(
        service.getChart({ fungibleId, period, currency }),
      ).rejects.toThrow('Unsupported currency code: jpy');

      expect(mockNetworkService.get).not.toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const networkError = new Error('Network timeout');

      mockNetworkService.get.mockRejectedValue(networkError);

      await expect(
        service.getChart({ fungibleId, period, currency }),
      ).rejects.toThrow();
    });

    it('should throw ZodError for invalid response schema', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      // Invalid response missing required fields
      mockNetworkService.get.mockResolvedValue({
        data: rawify({
          data: {
            type: 'fungible_charts',
            // missing id and attributes
          },
        }),
        status: 200,
      } as unknown as NetworkResponse<unknown>);

      await expect(
        service.getChart({ fungibleId, period, currency }),
      ).rejects.toThrow(ZodError);
    });

    it('should handle different fungible IDs correctly', async () => {
      const fungibleIds = ['eth', 'btc', 'usdc', 'dai'];

      for (const fungibleId of fungibleIds) {
        const zerionResponse = zerionChartResponseBuilder().build();
        mockNetworkService.get.mockResolvedValue({
          data: rawify(zerionResponse),
          status: 200,
        } as unknown as NetworkResponse<unknown>);

        await service.getChart({
          fungibleId,
          period: ChartPeriod.DAY,
          currency: 'usd',
        });

        expect(mockNetworkService.get).toHaveBeenCalledWith(
          expect.objectContaining({
            url: `${zerionBaseUri}/v1/fungibles/${fungibleId}/charts/day`,
          }),
        );
      }
    });

    it('should map Zerion response to domain chart correctly', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      const zerionResponse = zerionChartResponseBuilder()
        .with('data', {
          type: 'fungible_charts',
          id: 'test-id',
          attributes: {
            begin_at: '2024-01-01T00:00:00Z',
            end_at: '2024-01-02T00:00:00Z',
            stats: {
              first: 100,
              min: 95,
              avg: 102.5,
              max: 110,
              last: 105,
            },
            points: [
              [1704067200, 100],
              [1704070800, 105],
            ],
          },
        })
        .build();

      mockNetworkService.get.mockResolvedValue({
        data: rawify(zerionResponse),
        status: 200,
      } as unknown as NetworkResponse<unknown>);

      const result = await service.getChart({ fungibleId, period, currency });

      expect(result).toEqual({
        beginAt: '2024-01-01T00:00:00Z',
        endAt: '2024-01-02T00:00:00Z',
        stats: {
          first: 100,
          min: 95,
          avg: 102.5,
          max: 110,
          last: 105,
        },
        points: [
          [1704067200, 100],
          [1704070800, 105],
        ],
      });
    });

    it('should handle empty points array', async () => {
      const fungibleId = 'newtoken';
      const period = ChartPeriod.MAX;
      const currency = 'usd';

      const zerionResponse = zerionChartResponseBuilder()
        .with('data', {
          type: 'fungible_charts',
          id: 'test-id',
          attributes: {
            begin_at: '2024-01-01T00:00:00Z',
            end_at: '2024-01-01T00:00:00Z',
            stats: {
              first: 0,
              min: 0,
              avg: 0,
              max: 0,
              last: 0,
            },
            points: [], // No data points
          },
        })
        .build();

      mockNetworkService.get.mockResolvedValue({
        data: rawify(zerionResponse),
        status: 200,
      } as unknown as NetworkResponse<unknown>);

      const result = await service.getChart({ fungibleId, period, currency });

      expect((result as unknown as { points: Array<unknown> }).points).toEqual(
        [],
      );
      expect((result as unknown as { stats: unknown }).stats).toEqual({
        first: 0,
        min: 0,
        avg: 0,
        max: 0,
        last: 0,
      });
    });
  });
});
