import {
  deviateRandomlyByPercentage,
  offsetByPercentage,
} from '@/domain/common/utils/number';

describe('Number Utils', () => {
  describe('deviateRandomlyByPercentage', () => {
    beforeEach(() => {
      // Mock Math.random for deterministic tests
      jest.spyOn(Math, 'random');
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('Should deviate within the specified percentage range for positive numbers', () => {
      const baseNumber = 100;
      const percent = 10;

      // Test with Math.random() = 0.5 (middle of range)
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const resultMid = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMid).toBe(100); // No deviation at 0.5

      // Test with Math.random() = 0 (minimum deviation)
      jest.spyOn(Math, 'random').mockReturnValue(0);
      const resultMin = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMin).toBe(90);

      // Test with Math.random() = 1 (maximum deviation)
      jest.spyOn(Math, 'random').mockReturnValue(0.9999);
      const resultMax = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMax).toBeCloseTo(110, 0);
    });

    it('Should deviate within the specified percentage range for negative numbers', () => {
      const baseNumber = -100;
      const percent = 10;

      jest.spyOn(Math, 'random').mockReturnValue(0);
      const resultMin = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMin).toBe(-110);

      jest.spyOn(Math, 'random').mockReturnValue(0.9999);
      const resultMax = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMax).toBeCloseTo(-90, 0);
    });

    it('Should return zero when input is zero', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = deviateRandomlyByPercentage(0, 10);
      expect(result).toBe(0);
    });

    it('Should handle large percentages', () => {
      const baseNumber = 100;
      const percent = 100;

      jest.spyOn(Math, 'random').mockReturnValue(0);
      const resultMin = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMin).toBe(0);

      jest.spyOn(Math, 'random').mockReturnValue(0.9999);
      const resultMax = deviateRandomlyByPercentage(baseNumber, percent);
      expect(resultMax).toBeCloseTo(200, 0);
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
