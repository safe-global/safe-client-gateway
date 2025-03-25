import { typedDataBuilder } from '@/routes/messages/entities/__tests__/typed-data.builder';
import { createMessageDtoBuilder } from '@/routes/messages/entities/__tests__/create-message.dto.builder';
import { CreateMessageDtoSchema } from '@/routes/messages/entities/schemas/create-message.dto.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('CreateMessageDtoSchema', () => {
  describe('message', () => {
    it('should validate a valid typed data message', () => {
      const message = typedDataBuilder().build();
      const createMessageDto = createMessageDtoBuilder()
        .with('message', message)
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success).toBe(true);
    });

    it('should validate a valid string message', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('message', faker.word.words())
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success).toBe(true);
    });

    it('should not validate without a message', () => {
      const createMessageDto = createMessageDtoBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional properties
      delete createMessageDto.message;

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(!result.success && result.error.issues).toStrictEqual([
        {
          code: 'invalid_union',
          message: 'Invalid input',
          path: ['message'],
          unionErrors: [
            new ZodError([
              {
                code: 'invalid_type',
                expected: 'string',
                received: 'undefined',
                path: ['message'],
                message: 'Required',
              },
            ]),
            new ZodError([
              {
                code: 'invalid_type',
                expected: 'object',
                received: 'undefined',
                path: ['message'],
                message: 'Required',
              },
            ]),
          ],
        },
      ]);
    });
  });

  describe('safeAppId', () => {
    it('should validate a safeAppId of 0', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('safeAppId', 0)
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success).toBe(true);
    });

    it('should validate a positive integer safeAppId', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('safeAppId', faker.number.int({ min: 1 }))
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success).toBe(true);
    });

    it('should not validate a negative safeAppId', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('safeAppId', -1)
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'too_small',
            minimum: 0,
            type: 'number',
            inclusive: true,
            exact: false,
            message: 'Number must be greater than or equal to 0',
            path: ['safeAppId'],
          },
        ]),
      );
    });

    it('should not validate a float safeAppId', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('safeAppId', faker.number.float())
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'integer',
            received: 'float',
            message: 'Expected integer, received float',
            path: ['safeAppId'],
          },
        ]),
      );
    });

    it('should validate without safeAppId, defaulting to null', () => {
      const createMessageDto = createMessageDtoBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional properties
      delete createMessageDto.safeAppId;

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success && result.data.safeAppId).toBe(null);
    });
  });

  describe('signature', () => {
    it('should not validate a non-hex signature', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('signature', faker.string.numeric() as `0x${string}`)
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'custom',
            message: 'Invalid "0x" notated hex string',
            path: ['signature'],
          },
          {
            code: 'custom',
            message: 'Invalid hex bytes',
            path: ['signature'],
          },
          {
            code: 'custom',
            message: 'Invalid signature',
            path: ['signature'],
          },
        ]),
      );
    });

    it('should not validate without a signature', () => {
      const createMessageDto = createMessageDtoBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional properties
      delete createMessageDto.signature;

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(!result.success && result.error).toStrictEqual(
        new ZodError([
          {
            code: 'invalid_type',
            expected: 'string',
            received: 'undefined',
            path: ['signature'],
            message: 'Required',
          },
        ]),
      );
    });
  });

  describe('origin', () => {
    it('should validate without origin, defaulting to null', () => {
      const createMessageDto = createMessageDtoBuilder().build();
      // @ts-expect-error - inferred type doesn't allow optional properties
      delete createMessageDto.origin;

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success && result.data.origin).toBe(null);
    });

    it('should validate a stringified origin', () => {
      const createMessageDto = createMessageDtoBuilder()
        .with('origin', JSON.stringify({ example: faker.internet.url() }))
        .build();

      const result = CreateMessageDtoSchema.safeParse(createMessageDto);

      expect(result.success && result.data.origin).toBe(
        createMessageDto.origin,
      );
    });
  });
});
