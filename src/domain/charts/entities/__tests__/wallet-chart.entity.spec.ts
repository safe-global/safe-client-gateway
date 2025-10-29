import { WalletChartSchema } from '@/domain/charts/entities/wallet-chart.entity';
import { ZodError } from 'zod';

describe('WalletChartSchema', () => {
  it('should validate a valid wallet chart', () => {
    const validChart = {
      beginAt: '2024-01-01T00:00:00Z',
      endAt: '2024-01-02T00:00:00Z',
      points: [
        [1704067200, 10000],
        [1704070800, 10500],
      ],
    };

    const result = WalletChartSchema.parse(validChart);

    expect(result).toEqual(validChart);
  });

  it('should validate a wallet chart with empty points', () => {
    const validChart = {
      beginAt: '2024-01-01T00:00:00Z',
      endAt: '2024-01-02T00:00:00Z',
      points: [],
    };

    const result = WalletChartSchema.parse(validChart);

    expect(result).toEqual(validChart);
  });

  it('should reject invalid beginAt', () => {
    const invalidChart = {
      beginAt: 123,
      endAt: '2024-01-02T00:00:00Z',
      points: [],
    };

    expect(() => WalletChartSchema.parse(invalidChart)).toThrow(ZodError);
  });

  it('should reject invalid endAt', () => {
    const invalidChart = {
      beginAt: '2024-01-01T00:00:00Z',
      endAt: null,
      points: [],
    };

    expect(() => WalletChartSchema.parse(invalidChart)).toThrow(ZodError);
  });

  it('should reject invalid points array', () => {
    const invalidChart = {
      beginAt: '2024-01-01T00:00:00Z',
      endAt: '2024-01-02T00:00:00Z',
      points: [[1704067200, 'invalid']],
    };

    expect(() => WalletChartSchema.parse(invalidChart)).toThrow(ZodError);
  });

  it('should reject points with incorrect tuple size', () => {
    const invalidChart = {
      beginAt: '2024-01-01T00:00:00Z',
      endAt: '2024-01-02T00:00:00Z',
      points: [[1704067200, 10000, 'extra']],
    };

    expect(() => WalletChartSchema.parse(invalidChart)).toThrow(ZodError);
  });

  it('should reject missing required fields', () => {
    const invalidChart = {
      beginAt: '2024-01-01T00:00:00Z',
      endAt: '2024-01-02T00:00:00Z',
    };

    expect(() => WalletChartSchema.parse(invalidChart)).toThrow(ZodError);
  });
});
