import { ChartsRepository } from '@/domain/charts/charts.repository';
import type { IChartApi } from '@/datasources/charts-api/zerion-chart-api.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { ChartPeriod } from '@/domain/charts/entities/chart.entity';
import { chartBuilder } from '@/domain/charts/entities/__tests__/chart.builder';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { rawify } from '@/validation/entities/raw.entity';

const mockChartApi = jest.mocked({
  getChart: jest.fn(),
} as jest.MockedObjectDeep<IChartApi>);

const mockCacheService = jest.mocked({
  hGet: jest.fn(),
  hSet: jest.fn(),
  deleteByKey: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

describe('ChartsRepository', () => {
  let repository: ChartsRepository;

  beforeEach(() => {
    jest.resetAllMocks();
    repository = new ChartsRepository(mockChartApi, mockCacheService);
  });

  describe('getChart', () => {
    it('should return cached chart data when available', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const cachedChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(JSON.stringify(cachedChart));

      const result = await repository.getChart({ fungibleId, period, currency });

      expect(result).toEqual(cachedChart);
      expect(mockCacheService.hGet).toHaveBeenCalledWith(
        CacheRouter.getFungibleChartCacheDir({
          fungibleId,
          period,
          currency,
        }),
      );
      expect(mockChartApi.getChart).not.toHaveBeenCalled();
      expect(mockCacheService.hSet).not.toHaveBeenCalled();
    });

    it('should fetch from API and cache when cache is empty', async () => {
      const fungibleId = 'btc';
      const period = ChartPeriod.WEEK;
      const currency = 'eur';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      const result = await repository.getChart({ fungibleId, period, currency });

      expect(result).toEqual(apiChart);
      expect(mockCacheService.hGet).toHaveBeenCalled();
      expect(mockChartApi.getChart).toHaveBeenCalledWith({
        fungibleId,
        period,
        currency,
      });
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        CacheRouter.getFungibleChartCacheDir({
          fungibleId,
          period,
          currency,
        }),
        JSON.stringify(apiChart),
        900, // 15 minutes for week period
      );
    });

    it('should use tiered TTL strategy for hour period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.HOUR;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        60, // 1 minute for hour period
      );
    });

    it('should use tiered TTL strategy for day period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        300, // 5 minutes for day period
      );
    });

    it('should use tiered TTL strategy for week period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.WEEK;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        900, // 15 minutes for week period
      );
    });

    it('should use tiered TTL strategy for month period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.MONTH;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        3600, // 1 hour for month period
      );
    });

    it('should use tiered TTL strategy for 3months period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.THREE_MONTHS;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        21600, // 6 hours for 3months period
      );
    });

    it('should use tiered TTL strategy for year period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.YEAR;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        43200, // 12 hours for year period
      );
    });

    it('should use tiered TTL strategy for max period', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.MAX;
      const currency = 'usd';
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        86400, // 24 hours for max period
      );
    });

    it('should lowercase currency when generating cache key', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'USD'; // uppercase
      const apiChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(apiChart));

      await repository.getChart({ fungibleId, period, currency });

      expect(mockCacheService.hGet).toHaveBeenCalledWith(
        CacheRouter.getFungibleChartCacheDir({
          fungibleId,
          period,
          currency: 'usd', // lowercased
        }),
      );
    });

    it('should handle different fungible IDs independently', async () => {
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const ethChart = chartBuilder().build();
      const btcChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart
        .mockResolvedValueOnce(rawify(ethChart))
        .mockResolvedValueOnce(rawify(btcChart));

      await repository.getChart({ fungibleId: 'eth', period, currency });
      await repository.getChart({ fungibleId: 'btc', period, currency });

      expect(mockCacheService.hSet).toHaveBeenNthCalledWith(
        1,
        CacheRouter.getFungibleChartCacheDir({
          fungibleId: 'eth',
          period,
          currency,
        }),
        expect.anything(),
        expect.anything(),
      );

      expect(mockCacheService.hSet).toHaveBeenNthCalledWith(
        2,
        CacheRouter.getFungibleChartCacheDir({
          fungibleId: 'btc',
          period,
          currency,
        }),
        expect.anything(),
        expect.anything(),
      );
    });

    it('should validate chart data with Zod schema', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';
      const validChart = chartBuilder().build();

      mockCacheService.hGet.mockResolvedValue(undefined);
      mockChartApi.getChart.mockResolvedValue(rawify(validChart));

      const result = await repository.getChart({ fungibleId, period, currency });

      // Should not throw and return valid chart
      expect(result).toEqual(validChart);
    });

    it('should throw ZodError when cached data is invalid', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      // Invalid cached data
      mockCacheService.hGet.mockResolvedValue(
        JSON.stringify({ invalid: 'data' }),
      );

      await expect(
        repository.getChart({ fungibleId, period, currency }),
      ).rejects.toThrow();
    });

    it('should parse valid JSON from cache', async () => {
      const fungibleId = 'usdc';
      const period = ChartPeriod.MONTH;
      const currency = 'eur';
      const cachedChart = chartBuilder()
        .with('beginAt', '2024-01-01T00:00:00Z')
        .with('endAt', '2024-01-31T23:59:59Z')
        .build();

      mockCacheService.hGet.mockResolvedValue(JSON.stringify(cachedChart));

      const result = await repository.getChart({ fungibleId, period, currency });

      expect(result).toEqual(cachedChart);
      expect(mockChartApi.getChart).not.toHaveBeenCalled();
    });
  });

  describe('clearChart', () => {
    it('should delete cache entry for specific chart', async () => {
      const fungibleId = 'eth';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      await repository.clearChart({ fungibleId, period, currency });

      const cacheDir = CacheRouter.getFungibleChartCacheDir({
        fungibleId,
        period,
        currency: 'usd',
      });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(cacheDir.key);
    });

    it('should lowercase currency when clearing cache', async () => {
      const fungibleId = 'btc';
      const period = ChartPeriod.WEEK;
      const currency = 'EUR'; // uppercase

      await repository.clearChart({ fungibleId, period, currency });

      const cacheDir = CacheRouter.getFungibleChartCacheDir({
        fungibleId,
        period,
        currency: 'eur', // lowercased
      });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(cacheDir.key);
    });

    it('should clear cache for all periods independently', async () => {
      const fungibleId = 'eth';
      const currency = 'usd';
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
        await repository.clearChart({ fungibleId, period, currency });
      }

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(periods.length);
    });

    it('should not throw if cache entry does not exist', async () => {
      const fungibleId = 'unknown';
      const period = ChartPeriod.DAY;
      const currency = 'usd';

      mockCacheService.deleteByKey.mockResolvedValue(void 0 as unknown as number);

      await expect(
        repository.clearChart({ fungibleId, period, currency }),
      ).resolves.not.toThrow();
    });
  });
});
