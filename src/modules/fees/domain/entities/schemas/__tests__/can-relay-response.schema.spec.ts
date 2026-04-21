// SPDX-License-Identifier: FSL-1.1-MIT
import { CanRelayResponseSchema } from '@/modules/fees/domain/entities/schemas/can-relay-response.schema';

describe('CanRelayResponseSchema', () => {
  it('should validate a valid can-relay response', () => {
    const result = CanRelayResponseSchema.safeParse({ canRelay: true });

    expect(result.success).toBe(true);
  });

  it('should validate when canRelay is false', () => {
    const result = CanRelayResponseSchema.safeParse({ canRelay: false });

    expect(result.success).toBe(true);
  });

  it('should not allow a missing canRelay field', () => {
    const result = CanRelayResponseSchema.safeParse({});

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received undefined',
        path: ['canRelay'],
      },
    ]);
  });

  it('should not allow a non-boolean canRelay', () => {
    const result = CanRelayResponseSchema.safeParse({ canRelay: 'yes' });

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Invalid input: expected boolean, received string',
        path: ['canRelay'],
      },
    ]);
  });
});
