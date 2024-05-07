import {
  EditEmailDto,
  EditEmailDtoSchema,
} from '@/routes/email/entities/edit-email-dto.entity';
import { faker } from '@faker-js/faker';

describe('EditEmailDtoSchema', () => {
  it('should allow a valid EditEmailDto', () => {
    const editEmailDto: EditEmailDto = {
      emailAddress: faker.internet.email(),
    };

    const result = EditEmailDtoSchema.safeParse(editEmailDto);

    expect(result.success).toBe(true);
  });

  it('should not allow a non-email emailAddress', () => {
    const editEmailDto: EditEmailDto = {
      emailAddress: faker.lorem.word(),
    };

    const result = EditEmailDtoSchema.safeParse(editEmailDto);

    expect(!result.success && result.error.issues).toStrictEqual([
      {
        code: 'invalid_string',
        message: 'Invalid email',
        path: ['emailAddress'],
        validation: 'email',
      },
    ]);
  });
});
