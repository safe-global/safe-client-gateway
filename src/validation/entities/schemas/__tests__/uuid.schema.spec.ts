import { UuidSchema } from '@/validation/entities/schemas/uuid.schema';
import { faker } from '@faker-js/faker';

describe('UuidSchema', () => {
  it('should validate a valid UUID string', () => {
    const value = faker.string.uuid();

    const result = UuidSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should not validate a non-UUID string', () => {
    // Length of a UUID
    const value = faker.string.alphanumeric({ length: 36 });

    const result = UuidSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
