import { createSubmissionDtoBuilder } from '@/routes/targeted-messaging/entities/__tests__/create-submission.dto.builder';
import { CreateSubmissionDtoSchema } from '@/routes/targeted-messaging/entities/create-submission.dto.entity';

describe('CreateSubmissionDtoSchema', () => {
  it('should validate a valid CreateSubmissionDto', () => {
    const createSubmissionDto = createSubmissionDtoBuilder().build();

    const result = CreateSubmissionDtoSchema.safeParse(createSubmissionDto);

    expect(result.success).toBe(true);
  });

  it('should require completed', () => {
    const createSubmissionDto = createSubmissionDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    delete createSubmissionDto.completed;

    const result = CreateSubmissionDtoSchema.safeParse(createSubmissionDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Required',
        path: ['completed'],
        received: 'undefined',
      },
    ]);
  });

  it('should not allow a non-boolean completed value', () => {
    const createSubmissionDto = createSubmissionDtoBuilder().build();
    // @ts-expect-error - inferred type doesn't allow optional properties
    createSubmissionDto.completed = 'not-a-boolean';

    const result = CreateSubmissionDtoSchema.safeParse(createSubmissionDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'boolean',
        message: 'Expected boolean, received string',
        path: ['completed'],
        received: 'string',
      },
    ]);
  });
});
