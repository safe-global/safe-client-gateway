// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  makeNameSchema,
  NameSchema,
  sanitizeName,
} from '@/domain/common/schemas/name.schema';

describe('NameSchema', () => {
  it('should validate a valid name', () => {
    const accountName = 'a-valid_Account.name';

    const result = NameSchema.safeParse(accountName);

    expect(result.success && result.data).toBe(accountName);
  });

  it('should not validate a non-string name', () => {
    const name = 123;

    const result = NameSchema.safeParse(name);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received number',
        path: [],
      },
    ]);
  });

  it('should not validate null name', () => {
    const result = NameSchema.safeParse(null);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid input: expected string, received null',
        path: [],
      },
    ]);
  });

  it('should not validate a name shorter than 1 character', () => {
    const result = NameSchema.safeParse('');

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Names must be at least 1 character(s) long',
        path: [],
      },
    ]);
  });

  it('should not validate a name larger than 30 characters', () => {
    const accountName = faker.string.alphanumeric(31);

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Names must be at most 30 characters long',
        path: [],
      },
    ]);
  });
});

describe('name.schema — UTF-8 acceptance', () => {
  describe('accepts UTF-8 names', () => {
    it.each([
      'José',
      '山田太郎',
      'Müller 👍',
      'Анна',
      '李',
      'Jo',
    ])('accepts %s', (name) => {
      expect(NameSchema.parse(name)).toBe(name.normalize('NFC'));
    });
  });

  it('normalizes decomposed input to NFC', () => {
    // 'e' + U+0301 combining acute accent → 'é'
    const decomposed = 'é';
    expect(NameSchema.parse(decomposed)).toBe('é');
  });

  it('strips a bidi override (U+202E) and keeps the visible remainder', () => {
    expect(NameSchema.parse('ab‮cd')).toBe('abcd');
  });

  it('strips a zero-width space (U+200B)', () => {
    expect(NameSchema.parse('a​b')).toBe('ab');
  });

  it('preserves a ZWJ emoji sequence', () => {
    // family emoji via ZWJ joiners: 👨‍👩‍👧
    const family = '👨‍👩‍👧';
    expect(NameSchema.parse(family)).toBe(family.normalize('NFC'));
  });

  it('rejects a name that is empty after stripping', () => {
    // only a zero-width space and a bidi override
    const invisibles = '​‮';
    const result = NameSchema.safeParse(invisibles);
    expect(result.success).toBe(false);
  });

  it('rejects a name over max length (by code point)', () => {
    expect(() => makeNameSchema({ maxLength: 3 }).parse('abcd')).toThrow();
  });

  it('counts length by code point, not UTF-16 units', () => {
    // 👍 is one code point but two UTF-16 units; must count as 1.
    expect(makeNameSchema({ maxLength: 1 }).parse('👍')).toBe('👍');
  });

  it('accepts a single character (min length 1)', () => {
    expect(makeNameSchema({ minLength: 1 }).parse('李')).toBe('李');
  });
});

describe('makeNameSchema', () => {
  describe('with default parameters', () => {
    it('should create a schema with default min/max lengths', () => {
      const schema = makeNameSchema();
      const validName = 'ValidName123';

      const result = schema.safeParse(validName);

      expect(result.success && result.data).toBe(validName);
    });

    it('should behave the same as NameSchema', () => {
      const schema = makeNameSchema();
      const testName = 'Test_Name.123';

      const defaultResult = schema.safeParse(testName);
      const namedResult = NameSchema.safeParse(testName);

      expect(defaultResult.success).toBe(namedResult.success);
      if (defaultResult.success && namedResult.success) {
        expect(defaultResult.data).toBe(namedResult.data);
      }
    });
  });

  describe('with custom minLength', () => {
    it('should enforce custom minimum length', () => {
      const schema = makeNameSchema({ minLength: 5 });
      const shortName = 'abc';

      const result = schema.safeParse(shortName);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Names must be at least 5 character(s) long',
          path: [],
        },
      ]);
    });

    it('should accept names that meet custom minimum length', () => {
      const schema = makeNameSchema({ minLength: 5 });
      const validName = 'abcde'; // exactly 5 characters

      const result = schema.safeParse(validName);

      expect(result.success && result.data).toBe(validName);
    });

    it('should accept names longer than custom minimum length', () => {
      const schema = makeNameSchema({ minLength: 10 });
      const validName = 'ThisIsALongName'; // 15 characters

      const result = schema.safeParse(validName);

      expect(result.success && result.data).toBe(validName);
    });
  });

  describe('with custom maxLength', () => {
    it('should enforce custom maximum length', () => {
      const schema = makeNameSchema({ maxLength: 10 });
      const longName = 'ThisIsAVeryLongName'; // 18 characters

      const result = schema.safeParse(longName);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Names must be at most 10 characters long',
          path: [],
        },
      ]);
    });

    it('should accept names that meet custom maximum length', () => {
      const schema = makeNameSchema({ maxLength: 10 });
      const validName = 'ValidName1'; // exactly 10 characters

      const result = schema.safeParse(validName);

      expect(result.success && result.data).toBe(validName);
    });

    it('should accept names shorter than custom maximum length', () => {
      const schema = makeNameSchema({ maxLength: 50 });
      const validName = 'Short'; // 5 characters

      const result = schema.safeParse(validName);

      expect(result.success && result.data).toBe(validName);
    });
  });

  describe('with both custom minLength and maxLength', () => {
    it('should enforce both custom minimum and maximum lengths', () => {
      const schema = makeNameSchema({ minLength: 5, maxLength: 15 });

      // Test below minimum
      const tooShort = 'a'.repeat(3);
      const shortResult = schema.safeParse(tooShort);
      expect(shortResult.success).toBe(false);

      // Test above maximum
      const tooLong = 'a'.repeat(34);
      const longResult = schema.safeParse(tooLong);
      expect(longResult.success).toBe(false);

      // Test within range
      const validName = 'a'.repeat(9);
      const validResult = schema.safeParse(validName);
      expect(validResult.success && validResult.data).toBe(validName);
    });

    it('should validate edge cases for custom lengths', () => {
      const schema = makeNameSchema({ minLength: 8, maxLength: 12 });

      // Test exactly minimum length
      const minLength = 'a'.repeat(8);
      const minResult = schema.safeParse(minLength);
      expect(minResult.success && minResult.data).toBe(minLength);

      // Test exactly maximum length
      const maxLength = 'a'.repeat(12);
      const maxResult = schema.safeParse(maxLength);
      expect(maxResult.success && maxResult.data).toBe(maxLength);
    });
  });

  describe('UTF-8 names with custom lengths', () => {
    it('should accept valid UTF-8 characters with custom lengths', () => {
      const schema = makeNameSchema({ minLength: 1, maxLength: 50 });
      const validNames = [
        'Simple123',
        'José',
        '山田太郎',
        'Müller 👍',
        'Анна',
        '李',
      ];

      for (const name of validNames) {
        const result = schema.safeParse(name);
        expect(result.success).toBe(true);
      }
    });
  });

  describe('string trimming with custom lengths', () => {
    it('should trim whitespace before validation', () => {
      const schema = makeNameSchema({ minLength: 5, maxLength: 15 });
      const nameWithSpaces = '  ValidName  ';
      const expectedTrimmed = 'ValidName';

      const result = schema.safeParse(nameWithSpaces);

      expect(result.success && result.data).toBe(expectedTrimmed);
    });

    it('should validate length after trimming', () => {
      const schema = makeNameSchema({ minLength: 5, maxLength: 10 });
      const nameWithSpaces = '  abc  '; // 3 characters after trimming

      const result = schema.safeParse(nameWithSpaces);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: 'Names must be at least 5 character(s) long',
          path: [],
        },
      ]);
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle zero length', () => {
      const schemaZeroMin = makeNameSchema({ minLength: 0 });
      const emptyString = '';

      const result = schemaZeroMin.safeParse(emptyString);

      // Empty string after trimming — min 0 so length check passes, but
      // the schema should still succeed (empty is valid when min is 0)
      expect(result.success).toBe(true);
    });

    it('should handle non-string input with custom lengths', () => {
      const schema = makeNameSchema({ minLength: 5, maxLength: 50 });
      const numberInput = 12345;

      const result = schema.safeParse(numberInput);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_type',
          expected: 'string',
          message: 'Invalid input: expected string, received number',
          path: [],
        },
      ]);
    });
  });
});

describe('sanitizeName', () => {
  it('applies NFC normalization', () => {
    expect(sanitizeName('é')).toBe('é');
  });

  it('strips control characters (Cc)', () => {
    expect(sanitizeName('a\x00b')).toBe('ab');
  });

  it('strips format characters (Cf) like bidi override', () => {
    expect(sanitizeName('a‮b')).toBe('ab');
  });

  it('preserves ZWJ (U+200D)', () => {
    const withZwj = 'a‍b';
    expect(sanitizeName(withZwj)).toBe('a‍b');
  });

  it('preserves ZWNJ (U+200C)', () => {
    const withZwnj = 'a‌b';
    expect(sanitizeName(withZwnj)).toBe('a‌b');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeName('  hello  ')).toBe('hello');
  });
});
