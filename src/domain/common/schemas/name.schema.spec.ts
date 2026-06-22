// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import {
  DISALLOWED_CHARACTER_MESSAGE,
  makeNameSchema,
  NameSchema,
  sanitizeName,
} from '@/domain/common/schemas/name.schema';

// Invisible characters referenced by tests (defined by code point to avoid
// editor/encoding ambiguity).
const ZERO_WIDTH_SPACE = '​';
const BIDI_OVERRIDE = '‮';
const ZWJ = '‍';
const ZWNJ = '‌';

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

  it('should not validate a name shorter than 3 characters', () => {
    const result = NameSchema.safeParse('Jo');

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Names must be at least 3 character(s) long',
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
  describe('accepts UTF-8 letter names from any script', () => {
    it.each(['José', '山田太郎', 'Müller', 'Анна', 'محمد علي'])(
      'accepts %s',
      (name) => {
        expect(NameSchema.parse(name)).toBe(name.normalize('NFC'));
      },
    );
  });

  describe('accepts real-world contact names with allowed punctuation', () => {
    it.each([
      'Contact #1',
      'maria@web.com',
      'Smith & Co.',
      "O'Brien",
      'Acme, Inc.',
      'Doe (work)',
      'a-valid_Account.name',
    ])('accepts %s', (name) => {
      expect(NameSchema.parse(name)).toBe(name.normalize('NFC'));
    });
  });

  it('normalizes decomposed input to NFC', () => {
    // 'Jos' + 'e' + U+0301 combining acute accent → 'José' (4 code points, ≥ min)
    const decomposed = 'Jos' + 'é';
    expect(NameSchema.parse(decomposed)).toBe('José');
  });

  it('strips a bidi override (U+202E) and keeps the visible remainder', () => {
    expect(NameSchema.parse(`ab${BIDI_OVERRIDE}cd`)).toBe('abcd');
  });

  it('strips a zero-width space (U+200B)', () => {
    expect(NameSchema.parse(`a${ZERO_WIDTH_SPACE}bc`)).toBe('abc');
  });

  describe('rejects disallowed characters', () => {
    it.each([
      ['equals (formula trigger)', 'ab=cd'],
      ['plus', 'ab+cd'],
      ['asterisk', 'ab*cd'],
      ['slash', 'ab/cd'],
      ['backslash', 'ab\\cd'],
      ['less-than', 'ab<cd'],
      ['greater-than', 'ab>cd'],
      ['double quote', 'ab"cd'],
      ['percent', 'ab%cd'],
      ['dollar', 'ab$cd'],
      ['colon', 'ab:cd'],
      ['semicolon', 'ab;cd'],
      ['pipe', 'ab|cd'],
      ['curly brace', 'ab{cd'],
      ['square bracket', 'ab[cd'],
      ['emoji', 'abc\u{1F44D}'],
      ['symbol', 'abc★'],
    ])('rejects a name containing %s', (_label, name) => {
      const result = NameSchema.safeParse(name);
      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'custom',
          message: DISALLOWED_CHARACTER_MESSAGE,
          path: [],
        },
      ]);
    });
  });

  it('rejects a name that is empty after stripping', () => {
    // only a zero-width space and a bidi override
    const invisibles = `${ZERO_WIDTH_SPACE}${BIDI_OVERRIDE}`;
    const result = NameSchema.safeParse(invisibles);
    expect(result.success).toBe(false);
  });

  it('rejects an emoji even when it satisfies length bounds', () => {
    // 👍 is one valid-length code point but is not a letter/number/allowed punctuation
    const result = makeNameSchema({ minLength: 1, maxLength: 1 }).safeParse(
      '\u{1F44D}',
    );
    expect(result.success).toBe(false);
  });

  it('rejects a name over max length (by code point)', () => {
    expect(() => makeNameSchema({ maxLength: 3 }).parse('abcd')).toThrow();
  });

  it('counts length by code point, not UTF-16 units', () => {
    // 𝐀 (U+1D400) is one code point but two UTF-16 units; it is also a letter.
    expect(makeNameSchema({ minLength: 1, maxLength: 1 }).parse('\u{1D400}')).toBe(
      '\u{1D400}',
    );
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
        'Müller',
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

      // Empty string after trimming — min 0 so length check passes, and an
      // empty string contains no disallowed characters, so it succeeds.
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
    expect(sanitizeName(`a${BIDI_OVERRIDE}b`)).toBe('ab');
  });

  it('strips ZWJ (U+200D)', () => {
    expect(sanitizeName(`a${ZWJ}b`)).toBe('ab');
  });

  it('strips ZWNJ (U+200C)', () => {
    expect(sanitizeName(`a${ZWNJ}b`)).toBe('ab');
  });

  it('trims leading and trailing whitespace', () => {
    expect(sanitizeName('  hello  ')).toBe('hello');
  });
});
