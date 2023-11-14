import {
  Email,
  InvalidEmailFormatError,
} from '@/domain/email/entities/email.entity';
import { faker } from '@faker-js/faker';

describe('Email entity tests', () => {
  it.each(['test@email.com', faker.internet.email()])(
    '%s is a valid email',
    (input) => {
      const email = new Email(input);

      expect(email.value).toBe(input);
    },
  );

  it.each(['', ' ', '@', '@test.com', 'test.com', '.@.com'])(
    '%s is not a valid email',
    (input) => {
      expect(() => {
        new Email(input);
      }).toThrow(InvalidEmailFormatError);
    },
  );
});
