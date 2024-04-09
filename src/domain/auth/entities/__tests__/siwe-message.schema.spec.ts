import { siweMessageBuilder } from '@/domain/auth/entities/__tests__/siwe-message.builder';
import { SiweMessageSchema } from '@/domain/auth/entities/siwe-message.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { ZodError } from 'zod';

describe('SiweMessageSchema', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should validate a SiWe message', () => {
    const message = siweMessageBuilder().build();

    const result = SiweMessageSchema.safeParse(message);

    expect(result.success).toBe(true);
  });

  describe('scheme', () => {
    it('should validate with a RFC 3986 URI scheme', () => {
      const message = siweMessageBuilder()
        .with('scheme', faker.internet.protocol())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should validate without scheme', () => {
      const message = siweMessageBuilder().with('scheme', undefined).build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });
  });

  describe('domain', () => {
    it('should validate with a RFC 3986 URI domain', () => {
      const message = siweMessageBuilder()
        .with('scheme', undefined)
        .with('domain', faker.internet.domainName())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-RFC 3986 URI domain', () => {
      const message = siweMessageBuilder()
        .with('scheme', faker.internet.protocol())
        // A scheme is present in the domain
        .with('domain', faker.internet.url())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid RFC 3986 authority',
            path: ['domain'],
          },
        ]),
      );
    });

    it('should not validate a non-domain', () => {
      const message = siweMessageBuilder()
        .with('scheme', faker.internet.protocol())
        .with('domain', faker.lorem.sentence())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid RFC 3986 authority',
            path: ['domain'],
          },
        ]),
      );
    });
  });

  describe('address', () => {
    it('should validate a checksummed address', () => {
      const message = siweMessageBuilder()
        .with('address', getAddress(faker.finance.ethereumAddress()))
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-checksummed address', () => {
      const message = siweMessageBuilder()
        .with(
          'address',
          faker.finance.ethereumAddress().toLowerCase() as `0x${string}`,
        )
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid checksummed address',
            path: ['address'],
          },
        ]),
      );
    });

    it('should not validate a non-address', () => {
      const message = siweMessageBuilder()
        .with('address', faker.lorem.word() as `0x${string}`)
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid checksummed address',
            path: ['address'],
          },
        ]),
      );
    });
  });

  describe('statement', () => {
    it('should validate a statement', () => {
      const message = siweMessageBuilder()
        .with('statement', faker.lorem.sentence())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should allow an optional statement', () => {
      const message = siweMessageBuilder().with('statement', undefined).build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a statement with a newline', () => {
      const message = siweMessageBuilder()
        .with('statement', `${faker.lorem.sentence()}\n`)
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Must not include newlines',
            path: ['statement'],
          },
        ]),
      );
    });
  });

  describe('uri', () => {
    it('should validate an RFC 3986 URI', () => {
      const message = siweMessageBuilder()
        .with('uri', faker.internet.url({ appendSlash: false }))
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate an RFC 3986 domain', () => {
      const message = siweMessageBuilder()
        .with('uri', faker.internet.domainName())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            validation: 'url',
            code: 'invalid_string',
            message: 'Invalid url',
            path: ['uri'],
          },
        ]),
      );
    });

    it('should not validate non-URI', () => {
      const message = siweMessageBuilder()
        .with('uri', faker.lorem.word())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            validation: 'url',
            code: 'invalid_string',
            message: 'Invalid url',
            path: ['uri'],
          },
        ]),
      );
    });
  });

  describe('version', () => {
    it('should validate version 1', () => {
      const message = siweMessageBuilder().with('version', '1').build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-version 1', () => {
      const message = siweMessageBuilder()
        .with('version', '2' as '1')
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            received: '2',
            code: 'invalid_literal',
            expected: '1',
            path: ['version'],
            message: 'Invalid literal value, expected "1"',
          },
        ]),
      );
    });
  });

  describe('chainId', () => {
    it('should validate an EIP-155 Chain ID', () => {
      const message = siweMessageBuilder()
        .with('chainId', faker.number.int())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-EIP-155 Chain ID', () => {
      const message = siweMessageBuilder()
        .with('chainId', faker.lorem.word() as unknown as number)
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'number',
            received: 'string',
            path: ['chainId'],
            message: 'Expected number, received string',
          },
        ]),
      );
    });
  });

  describe('nonce', () => {
    it('should validate an alphanumeric nonce of at least 8 characters', () => {
      const message = siweMessageBuilder()
        .with('nonce', faker.string.alphanumeric({ length: 8 }))
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-alphanumeric nonce', () => {
      const message = siweMessageBuilder()
        .with('nonce', faker.lorem.sentence())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            validation: 'regex',
            code: 'invalid_string',
            message: 'Invalid',
            path: ['nonce'],
          },
        ]),
      );
    });

    it('should not validate a nonce of less than 8 characters', () => {
      const message = siweMessageBuilder()
        .with('nonce', faker.string.alphanumeric({ length: 7 }))
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'too_small',
            minimum: 8,
            type: 'string',
            inclusive: true,
            exact: false,
            message: 'String must contain at least 8 character(s)',
            path: ['nonce'],
          },
        ]),
      );
    });
  });

  describe('issuedAt', () => {
    it('should validate an ISO 8601 datetime string', () => {
      const message = siweMessageBuilder()
        .with('issuedAt', faker.date.recent().toISOString())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-ISO 8601 datetime string', () => {
      const message = siweMessageBuilder()
        .with('issuedAt', faker.lorem.sentence())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_string',
            validation: 'datetime',
            message: 'Invalid datetime',
            path: ['issuedAt'],
          },
        ]),
      );
    });
  });

  describe('expirationTime', () => {
    it('should validate an ISO 8601 datetime string', () => {
      const message = siweMessageBuilder()
        .with('expirationTime', faker.date.future().toISOString())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('allow an optional expirationTime', () => {
      const message = siweMessageBuilder()
        .with('expirationTime', undefined)
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-ISO 8601 datetime string', () => {
      const message = siweMessageBuilder()
        .with('expirationTime', faker.lorem.sentence())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_string',
            validation: 'datetime',
            message: 'Invalid datetime',
            path: ['expirationTime'],
          },
        ]),
      );
    });
  });

  describe('notBefore', () => {
    it('should validate an ISO 8601 datetime string', () => {
      const message = siweMessageBuilder()
        .with('notBefore', faker.date.past().toISOString())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should allow an optional notBefore', () => {
      const message = siweMessageBuilder().with('notBefore', undefined).build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-ISO 8601 datetime string', () => {
      const message = siweMessageBuilder()
        .with('notBefore', faker.lorem.sentence())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_string',
            validation: 'datetime',
            message: 'Invalid datetime',
            path: ['notBefore'],
          },
        ]),
      );
    });
  });

  describe('requestId', () => {
    it('should validate a requestId', () => {
      const message = siweMessageBuilder()
        .with('requestId', faker.string.uuid())
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('allow an optional requestId', () => {
      const message = siweMessageBuilder().with('requestId', undefined).build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-string requestId', () => {
      const message = siweMessageBuilder()
        .with('requestId', faker.number.int() as unknown as string)
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'number',
            path: ['requestId'],
            message: 'Expected string, received number',
          },
        ]),
      );
    });
  });

  describe('resources', () => {
    it('should validate an array of RFC 3986 URIs', () => {
      const message = siweMessageBuilder()
        .with('resources', [faker.internet.url({ appendSlash: false })])
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not allow an array of RFC 3986 domains', () => {
      const message = siweMessageBuilder()
        .with('resources', [faker.internet.domainName()])
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            validation: 'url',
            code: 'invalid_string',
            message: 'Invalid url',
            path: ['resources', 0],
          },
        ]),
      );
    });

    it('allow an optional resources', () => {
      const message = siweMessageBuilder().with('resources', undefined).build();

      const result = SiweMessageSchema.safeParse(message);

      expect(result.success).toBe(true);
    });

    it('should not validate a non-array of RFC 3986 URIs', () => {
      const message = siweMessageBuilder()
        .with('resources', faker.lorem.sentence() as unknown as string[])
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'array',
            received: 'string',
            path: ['resources'],
            message: 'Expected array, received string',
          },
        ]),
      );
    });

    it('should not validate a resource with a newline', () => {
      const message = siweMessageBuilder()
        .with('resources', [`${faker.internet.url({ appendSlash: false })}\n`])
        .build();

      const result = SiweMessageSchema.safeParse(message);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Must not include newlines',
            path: ['resources', 0],
          },
        ]),
      );
    });
  });

  it.each([
    ['domain' as const],
    ['address' as const],
    ['uri' as const],
    ['version' as const],
    ['chainId' as const],
    ['nonce' as const],
  ])('should not allow %s to be undefined', (key) => {
    const message = siweMessageBuilder().build();
    delete message[key];

    const result = SiweMessageSchema.safeParse(message);

    expect(
      !result.success &&
        result.error.issues.length === 1 &&
        result.error.issues[0].path.length === 1 &&
        result.error.issues[0].path[0] === key,
    ).toBe(true);
  });
});
