import { ZodError } from 'zod';
import { HelloWorldJobDataSchema } from '@/datasources/jobs/entities/schemas/hello-world-job-data.schema';
import { faker } from '@faker-js/faker';

describe('HelloWorldJobDataSchema', () => {
  it('should validate a valid HelloWorldJobData', () => {
    const validData = {
      message: faker.lorem.sentence(),
      timestamp: Date.now(),
    };

    const result = HelloWorldJobDataSchema.safeParse(validData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validData);
    }
  });

  it('should reject empty message', () => {
    const invalidData = {
      message: '',
      timestamp: Date.now(),
    };

    const result = HelloWorldJobDataSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].message).toBe('Message cannot be empty');
    }
  });

  it('should reject missing message', () => {
    const invalidData = {
      timestamp: Date.now(),
    };

    const result = HelloWorldJobDataSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].path).toEqual(['message']);
    }
  });

  it('should reject missing timestamp', () => {
    const invalidData = {
      message: faker.lorem.sentence(),
    };

    const result = HelloWorldJobDataSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].path).toEqual(['timestamp']);
    }
  });

  it('should reject negative timestamp', () => {
    const invalidData = {
      message: faker.lorem.sentence(),
      timestamp: -1,
    };

    const result = HelloWorldJobDataSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].message).toBe(
        'Timestamp must be a positive integer',
      );
    }
  });

  it('should reject non-integer timestamp', () => {
    const invalidData = {
      message: faker.lorem.sentence(),
      timestamp: 12.34,
    };

    const result = HelloWorldJobDataSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].code).toBe('invalid_type');
    }
  });

  it('should reject non-string message', () => {
    const invalidData = {
      message: 123,
      timestamp: Date.now(),
    };

    const result = HelloWorldJobDataSchema.safeParse(invalidData);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
      expect(result.error.issues[0].path).toEqual(['message']);
    }
  });
});
