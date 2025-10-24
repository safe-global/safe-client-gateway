import { BadRequestException } from '@nestjs/common';
import { ProviderValidationPipe } from '@/routes/portfolio/pipes/provider-validation.pipe';
import { PortfolioProvider } from '@/domain/portfolio/entities/portfolio-provider.enum';

describe('ProviderValidationPipe', () => {
  let pipe: ProviderValidationPipe;

  beforeEach(() => {
    pipe = new ProviderValidationPipe();
  });

  describe('transform', () => {
    it('should accept valid provider: zerion', () => {
      const result = pipe.transform('zerion');
      expect(result).toBe(PortfolioProvider.ZERION);
    });

    it('should accept valid provider: zapper', () => {
      const result = pipe.transform('zapper');
      expect(result).toBe(PortfolioProvider.ZAPPER);
    });

    it('should normalize uppercase to lowercase', () => {
      const result = pipe.transform('ZERION');
      expect(result).toBe(PortfolioProvider.ZERION);
    });

    it('should normalize mixed case to lowercase', () => {
      const result = pipe.transform('ZeRiOn');
      expect(result).toBe(PortfolioProvider.ZERION);
    });

    it('should throw BadRequestException for invalid provider', () => {
      expect(() => pipe.transform('invalid')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException with descriptive message for invalid provider', () => {
      try {
        pipe.transform('invalid-provider');
        fail('Expected BadRequestException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        if (error instanceof BadRequestException) {
          expect(error.message).toContain('Invalid provider');
          expect(error.message).toContain('invalid-provider');
          expect(error.message).toContain('zerion');
          expect(error.message).toContain('zapper');
        }
      }
    });

    it('should throw BadRequestException for empty string', () => {
      expect(() => pipe.transform('')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for undefined', () => {
      expect(() => pipe.transform(undefined as unknown as string)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for null', () => {
      expect(() => pipe.transform(null as unknown as string)).toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for whitespace only', () => {
      expect(() => pipe.transform('   ')).toThrow(BadRequestException);
    });

    it('should handle provider with leading/trailing whitespace by lowercasing', () => {
      // Note: The pipe lowercases but doesn't trim, so this will fail
      // This documents current behavior - could be improved
      expect(() => pipe.transform(' zerion ')).toThrow(BadRequestException);
    });
  });
});
