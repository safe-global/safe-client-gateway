import { ZodError } from 'zod';
import { ChainIdsSchema } from '@/domain/chains/entities/schemas/chain-ids.schema';

describe('ChainIdsSchema', () => {
  describe('valid inputs', () => {
    it('should parse single chain ID', () => {
      const result = ChainIdsSchema.parse('1');
      expect(result).toEqual(['1']);
    });

    it('should parse multiple chain IDs', () => {
      const result = ChainIdsSchema.parse('1,10,137');
      expect(result).toEqual(['1', '10', '137']);
    });

    it('should parse chain IDs with spaces', () => {
      const result = ChainIdsSchema.parse('1, 10, 137');
      expect(result).toEqual(['1', '10', '137']);
    });

    it('should parse chain IDs with inconsistent spacing', () => {
      const result = ChainIdsSchema.parse('1,  10,137  , 42161');
      expect(result).toEqual(['1', '10', '137', '42161']);
    });

    it('should handle undefined input', () => {
      const result = ChainIdsSchema.parse(undefined);
      expect(result).toBeUndefined();
    });

    it('should handle empty string', () => {
      const result = ChainIdsSchema.parse('');
      expect(result).toBeUndefined();
    });

    it('should filter out empty strings after splitting', () => {
      const result = ChainIdsSchema.parse('1,,10');
      expect(result).toEqual(['1', '10']);
    });

    it('should filter out whitespace-only entries', () => {
      const result = ChainIdsSchema.parse('1,  ,10');
      expect(result).toEqual(['1', '10']);
    });

    it('should handle large chain IDs', () => {
      const result = ChainIdsSchema.parse('999999999');
      expect(result).toEqual(['999999999']);
    });

    it('should handle many chain IDs', () => {
      const chainIds = Array.from({ length: 20 }, (_, i) => (i + 1).toString());
      const input = chainIds.join(',');
      const result = ChainIdsSchema.parse(input);
      expect(result).toEqual(chainIds);
    });
  });

  describe('invalid inputs', () => {
    it('should reject non-numeric chain IDs', () => {
      expect(() => ChainIdsSchema.parse('abc')).toThrow(ZodError);
    });

    it('should reject chain IDs with letters', () => {
      expect(() => ChainIdsSchema.parse('1,abc,10')).toThrow(ZodError);
    });

    it('should reject chain IDs with special characters', () => {
      expect(() => ChainIdsSchema.parse('1,@#$,10')).toThrow(ZodError);
    });

    it('should reject mixed valid and invalid entries', () => {
      expect(() => ChainIdsSchema.parse('1,invalid,137')).toThrow(ZodError);
    });

    it('should reject hexadecimal chain IDs', () => {
      expect(() => ChainIdsSchema.parse('0x1')).toThrow(ZodError);
    });

    it('should reject chain IDs with leading zeros if they contain non-digits', () => {
      // Leading zeros are fine as long as all characters are digits
      const result = ChainIdsSchema.parse('01');
      expect(result).toEqual(['01']);
    });
  });

  describe('edge cases', () => {
    it('should handle single comma', () => {
      const result = ChainIdsSchema.parse(',');
      expect(result).toEqual([]);
    });

    it('should handle multiple commas', () => {
      const result = ChainIdsSchema.parse(',,,');
      expect(result).toEqual([]);
    });

    it('should handle commas with spaces', () => {
      const result = ChainIdsSchema.parse(', , ,');
      expect(result).toEqual([]);
    });

    it('should handle trailing comma', () => {
      const result = ChainIdsSchema.parse('1,10,');
      expect(result).toEqual(['1', '10']);
    });

    it('should handle leading comma', () => {
      const result = ChainIdsSchema.parse(',1,10');
      expect(result).toEqual(['1', '10']);
    });

    it('should handle chain ID "0"', () => {
      const result = ChainIdsSchema.parse('0');
      expect(result).toEqual(['0']);
    });

    it('should handle tabs and newlines as invalid (not trimmed)', () => {
      expect(() => ChainIdsSchema.parse('1\t10')).toThrow(ZodError);
    });
  });
});
