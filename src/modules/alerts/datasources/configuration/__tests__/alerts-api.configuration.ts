import { registerAs } from '@nestjs/config';
import { faker } from '@faker-js/faker';

export default registerAs('alerts-api', () => ({
  apiKey: faker.string.hexadecimal({ length: 32 }),
  baseUri: faker.internet.url({ appendSlash: false }),
  account: faker.string.sample(),
  project: faker.string.sample(),
}));
