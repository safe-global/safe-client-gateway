import { TimezoneSchema } from '@/validation/entities/schemas/timezone.schema';

describe('TimezoneSchema()', () => {
  it('Should return true if the timezone is valid', () => {
    const input = 'Europe/Berlin';

    const result = TimezoneSchema.safeParse(input);

    expect(result.success).toBe(true);
  });

  it('Should return false if the timezone is invalid', () => {
    const input = 'Invalid/Timezone';

    const result = TimezoneSchema.safeParse(input);

    expect(result.success).toBe(false);
  });

  it('Should return true and not validate if the timezone is not provided', () => {
    const input = undefined;

    const result = TimezoneSchema.safeParse(input);

    expect(result.success).toBe(true);
  });
});
