import {
  databaseEnumTransformer,
  getEnumKey,
  getStringEnumKeys,
} from '@/domain/common/utils/enum';

enum NumericEnum {
  A,
  B,
}

enum NumericEnumExplicit {
  A = 0,
  B = 1,
}

enum StringEnum {
  A = 'A',
  B = 'B',
}

describe('enum utils', () => {
  describe('getEnumKey', () => {
    it('should return the key of a numeric enum with no explicit values', () => {
      const result = getEnumKey(NumericEnum, 1);

      expect(result).toEqual('B');
    });

    it('should return the key of a numeric enum with explicit values', () => {
      const result = getEnumKey(NumericEnumExplicit, 1);

      expect(result).toEqual('B');
    });

    it('should throw for invalid enum values', () => {
      expect(() => getEnumKey(NumericEnum, 2)).toThrow('Invalid enum value: 2');
    });

    it('should return the key of a string enum', () => {
      const result = getEnumKey(StringEnum, 'B' as unknown as number);

      expect(result).toEqual('B');
    });
  });

  describe('databaseEnumTransformer', () => {
    describe('to', () => {
      it('should return the value of a numeric enum with no explicit values', () => {
        const result = databaseEnumTransformer(NumericEnum).to('B');

        expect(result).toEqual(1);
      });

      it('should return the value of a numeric enum with explicit values', () => {
        const result = databaseEnumTransformer(NumericEnumExplicit).to('B');

        expect(result).toEqual(1);
      });

      it('should throw for invalid enum keys', () => {
        expect(() =>
          databaseEnumTransformer(NumericEnumExplicit).to('C'),
        ).toThrow('Invalid enum key: C');
      });

      it('should return the value of a string enum', () => {
        const result = databaseEnumTransformer(StringEnum).to(
          'B' as unknown as keyof typeof StringEnum,
        );

        expect(result).toEqual('B');
      });
    });

    describe('from', () => {
      it('should return the key of a numeric enum with no explicit values', () => {
        const result = databaseEnumTransformer(NumericEnum).from(1);

        expect(result).toEqual('B');
      });

      it('should return the key of a numeric enum with explicit values', () => {
        const result = databaseEnumTransformer(NumericEnumExplicit).from(1);

        expect(result).toEqual('B');
      });

      it('should throw for invalid enum values', () => {
        expect(() =>
          databaseEnumTransformer(NumericEnumExplicit).from(2),
        ).toThrow('Invalid enum value: 2');
      });

      it('should return the key of a string enum', () => {
        const result = databaseEnumTransformer(StringEnum).from(
          'B' as unknown as number,
        );

        expect(result).toEqual('B');
      });
    });
  });

  describe('getStringEnumKeys', () => {
    it('should return the key of a numeric enum with no explicit values', () => {
      const result = getStringEnumKeys(NumericEnum);

      expect(result).toEqual(['A', 'B']);
    });

    it('should return the key of a numeric enum with explicit values', () => {
      const result = getStringEnumKeys(NumericEnumExplicit);

      expect(result).toEqual(['A', 'B']);
    });

    it('should return all string keys of a string enum', () => {
      const result = getStringEnumKeys(StringEnum);

      expect(result).toEqual(['A', 'B']);
    });
  });
});
