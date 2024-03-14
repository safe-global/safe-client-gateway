import { fakeJson } from '@/__tests__/faker';
import { createMessageDtoBuilder } from '@/routes/messages/entities/__tests__/create-message.dto.builder';
import { CreateMessageDtoSchema } from '@/routes/messages/entities/schemas/create-message.dto.schema';
import { faker } from '@faker-js/faker';
import { ZodError } from 'zod';

describe('CreateMessageDtoSchema', () => {
  it('should validate a valid record message', () => {
    const createMessageDto = createMessageDtoBuilder()
      .with('message', JSON.parse(fakeJson()))
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

  it('should allow optional safeAppId, defaulting to null', () => {
    const createMessageDto = createMessageDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete createMessageDto.safeAppId;

    const result = CreateMessageDtoSchema.safeParse(createMessageDto);

    expect(result.success && result.data.safeAppId).toBe(null);
  });

  it('should not validated without a message', () => {
    const createMessageDto = createMessageDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete createMessageDto.message;

    const result = CreateMessageDtoSchema.safeParse(createMessageDto);

    expect(!result.success && result.error).toStrictEqual(
      new ZodError([
        {
          code: 'invalid_union',
          unionErrors: [
            // @ts-expect-error - inferred type doesn't allow optional properties
            {
              issues: [
                {
                  code: 'invalid_type',
                  expected: 'object',
                  received: 'undefined',
                  path: ['message'],
                  message: 'Required',
                },
              ],
              name: 'ZodError',
            },
            // @ts-expect-error - inferred type doesn't allow optional properties
            {
              issues: [
                {
                  code: 'invalid_type',
                  expected: 'string',
                  received: 'undefined',
                  path: ['message'],
                  message: 'Required',
                },
              ],
              name: 'ZodError',
            },
          ],
          path: ['message'],
          message: 'Invalid input',
        },
      ]),
    );
  });
  it('should not validated without a signature', () => {
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
