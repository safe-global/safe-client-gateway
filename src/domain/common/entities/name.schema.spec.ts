import {
  makeNameSchema,
  NameSchema,
} from '@/domain/common/entities/name.schema';
import { faker } from '@faker-js/faker/.';
import { ZodError } from 'zod';

describe('NameSchema', () => {
  it('should validate a valid name', () => {
    const accountName = 'a-valid_Account.name';

    const result = NameSchema.safeParse(accountName);

    expect(result.success && result.data).toBe(accountName);
  });

  it('should not validate an non-string name', () => {
    const name = 123;

    const result = NameSchema.safeParse(name);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: [],
          message: 'Expected string, received number',
        },
      ]),
    );
  });

  it('should not validate null name', () => {
    const result = NameSchema.safeParse(null);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'null',
          path: [],
          message: 'Expected string, received null',
        },
      ]),
    );
  });

  it('should not validate an name shorter than 3 characters', () => {
    const accountName = faker.string.alphanumeric(2);

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_small',
          minimum: 3,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Names must be at least 3 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an name larger than 30 characters', () => {
    const accountName = faker.string.alphanumeric(31);

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'too_big',
          maximum: 30,
          type: 'string',
          inclusive: true,
          exact: false,
          message: 'Names must be at most 30 characters long',
          path: [],
        },
      ]),
    );
  });

  it('should not validate an name containing not allowed characters', () => {
    const forbiddenCharsString = '!@#$%^&*()';
    const accountName = `${faker.string.alphanumeric(2)}${faker.string.fromCharacters(forbiddenCharsString)}${faker.string.alphanumeric(2)}`;

    const result = NameSchema.safeParse(accountName);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          validation: 'regex',
          code: 'invalid_string',
          message:
            'Names must start with a letter or number and can contain alphanumeric characters, spaces, periods, underscores, or hyphens',
          path: [],
        },
      ]),
    );
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

      expect(result.success).toBe(false);
      expect(result.error).toStrictEqual(
        new ZodError([
          {
            code: 'too_small',
            minimum: 5,
            type: 'string',
            inclusive: true,
            exact: false,
            message: 'Names must be at least 5 characters long',
            path: [],
          },
        ]),
      );
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

      expect(result.success).toBe(false);
      expect(result.error).toStrictEqual(
        new ZodError([
          {
            code: 'too_big',
            maximum: 10,
            type: 'string',
            inclusive: true,
            exact: false,
            message: 'Names must be at most 10 characters long',
            path: [],
          },
        ]),
      );
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

  describe('regex validation with custom lengths', () => {
    it('should still enforce regex rules with custom lengths', () => {
      const schema = makeNameSchema({ minLength: 5, maxLength: 50 });
      const invalidName = 'Valid@Name'; // contains invalid character

      const result = schema.safeParse(invalidName);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toStrictEqual(
          new ZodError([
            {
              validation: 'regex',
              code: 'invalid_string',
              message:
                'Names must start with a letter or number and can contain alphanumeric characters, spaces, periods, underscores, or hyphens',
              path: [],
            },
          ]),
        );
      }
    });

    it('should accept valid characters with custom lengths', () => {
      const schema = makeNameSchema({ minLength: 3, maxLength: 50 });
      const validNames = [
        'Simple123',
        'With Spaces',
        'With.Periods',
        'With_Underscores',
        'With-Hyphens',
        'Mixed_Types.And-Spaces 123',
      ];

      validNames.forEach((name) => {
        const result = schema.safeParse(name);
        expect(result.success && result.data).toBe(name);
      });
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

      expect(result.success).toBe(false);
      expect(result.error).toStrictEqual(
        new ZodError([
          {
            code: 'too_small',
            minimum: 5,
            type: 'string',
            inclusive: true,
            exact: false,
            message: 'Names must be at least 5 characters long',
            path: [],
          },
        ]),
      );
    });
  });

  describe('edge cases and error scenarios', () => {
    it('should handle zero length', () => {
      const schemaZeroMin = makeNameSchema({ minLength: 0 });
      const emptyString = '';

      const result = schemaZeroMin.safeParse(emptyString);

      // Should still fail on regex (empty string doesn't match the pattern)
      expect(result.success).toBe(false);
    });

    it('should handle non-string input with custom lengths', () => {
      const schema = makeNameSchema({ minLength: 5, maxLength: 50 });
      const numberInput = 12345;

      const result = schema.safeParse(numberInput);

      expect(result.success).toBe(false);
      expect(result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: [],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });
});
