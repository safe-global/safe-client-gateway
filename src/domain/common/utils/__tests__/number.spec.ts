import {
  deviateRandomlyByPercentage,
  offsetByPercentage,
} from '@/domain/common/utils/number';

describe('Number Utils', () => {
  describe('deviateRandomlyByPercentage', () => {
    it('Should deviate within the specified percentage range for positive numbers', () => {
      const baseNumber = 100;
      const percent = 10;
      const result = deviateRandomlyByPercentage(baseNumber, percent);

      // Result should be within ±10% of 100 (90-110)
      expect(result).toBeGreaterThanOrEqual(90);
      expect(result).toBeLessThanOrEqual(110);
    });

    it('Should deviate within the specified percentage range for negative numbers', () => {
      const baseNumber = -100;
      const percent = 10;
      const result = deviateRandomlyByPercentage(baseNumber, percent);

      // Result should be within ±10% of -100 (-110 to -90)
      expect(result).toBeGreaterThanOrEqual(-110);
      expect(result).toBeLessThanOrEqual(-90);
    });

    it('Should return zero when input is zero', () => {
      const result = deviateRandomlyByPercentage(0, 10);
      expect(result).toBe(0);
    });

    it('Should handle large percentages', () => {
      const baseNumber = 100;
      const percent = 100;
      const result = deviateRandomlyByPercentage(baseNumber, percent);

      // Result should be within ±100% of 100 (0-200)
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(200);
    });
  });

  describe('offsetByPercentage', () => {
    it('Should increase positive numbers by the specified percentage', () => {
      const result = offsetByPercentage(100, 10);
      // 100 + 10% = 110
      expect(result).toBe(110);
    });

    it('Should increase negative numbers by the absolute percentage', () => {
      const result = offsetByPercentage(-100, 10);
      // -100 + 10% = -90
      expect(result).toBe(-90);
    });

    it('Should return zero when input is zero', () => {
      const result = offsetByPercentage(0, 10);
      expect(result).toBe(0);
    });

    it('Should handle large percentages', () => {
      const result = offsetByPercentage(100, 100);
      // 100 + 100% = 200
      expect(result).toBe(200);
    });

    it('Should round up to the nearest integer', () => {
      const result = offsetByPercentage(100, 33.33);
      // 100 + 33.33% = 133.33, rounded up to 134
      expect(result).toBe(134);
    });
  });
});
