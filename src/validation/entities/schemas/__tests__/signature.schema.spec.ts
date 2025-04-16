import { faker } from '@faker-js/faker';
import { SignatureSchema } from '@/validation/entities/schemas/signature.schema';

describe('SignatureSchema', () => {
  it('should validate a signature', () => {
    const signature = faker.string.hexadecimal({
      length: 130,
    }) as `0x${string}`;

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should validate a concatenated signature', () => {
    const signature = faker.string.hexadecimal({
      length: 130 * faker.number.int({ min: 2, max: 5 }),
    }) as `0x${string}`;

    const result = SignatureSchema.safeParse(signature);

    expect(result.success).toBe(true);
  });

  it('should not validate a non-hex signature', () => {
    const signature = faker.string.alphanumeric() as `0x${string}`;

    const result = SignatureSchema.safeParse(signature);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid "0x" notated hex string',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid hex bytes',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });

  it('should not validate a incorrect length signature', () => {
    const signature = faker.string.hexadecimal({
      length: 129,
    }) as `0x${string}`;

    const result = SignatureSchema.safeParse(signature);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'custom',
        message: 'Invalid hex bytes',
        path: [],
      },
      {
        code: 'custom',
        message: 'Invalid signature',
        path: [],
      },
    ]);
  });
});
