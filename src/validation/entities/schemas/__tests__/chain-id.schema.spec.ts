// SPDX-License-Identifier: FSL-1.1-MIT
import { ChainIdSchema } from '@/validation/entities/schemas/chain-id.schema';

describe('ChainIdSchema', () => {
  it('should accept a valid chain ID string', () => {
    const result = ChainIdSchema.safeParse('1');

    expect(result.success && result.data).toBe('1');
  });

  it('should coerce a numeric chain ID to a string', () => {
    const result = ChainIdSchema.safeParse(1);

    expect(result.success && result.data).toBe('1');
  });

  it.each([
    ['zero', '0'],
    ['leading zero', '01'],
    ['negative', '-1'],
    ['decimal', '1.5'],
    ['non-numeric', 'abc'],
    ['empty', ''],
  ])('should reject a %s chain ID', (_label, value) => {
    const result = ChainIdSchema.safeParse(value);

    expect(result.success).toBe(false);
  });
});
