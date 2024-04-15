import { registerAs } from '@nestjs/config';
import { faker } from '@faker-js/faker';

export default registerAs('jwt', () => ({
  issuer: faker.lorem.word(),
  secret: faker.string.alphanumeric(),
}));
