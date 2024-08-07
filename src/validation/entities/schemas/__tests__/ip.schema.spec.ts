import { IpSchema } from '@/validation/entities/schemas/ip.schema';

describe('IpSchema', () => {
  it('should validate a valid IP address', () => {
    const value = '192.168.0.1';
    const result = IpSchema.safeParse(value);

    expect(result.success && result.data).toBe(value);
  });

  it('should not validate a non-IP address', () => {
    const value = 'not-an-ip';
    const result = IpSchema.safeParse(value);

    expect(result.success).toBe(false);
  });

  it('should not validate an invalid IP address', () => {
    const value = '192.168.0.256';
    const result = IpSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
