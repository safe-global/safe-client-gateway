// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { registerAs } from '@nestjs/config';

export default registerAs('alerts-api', () => ({
  apiKey: faker.string.hexadecimal({ length: 32 }),
  baseUri: faker.internet.url({ appendSlash: false }),
  account: faker.string.sample(),
  project: faker.string.sample(),
}));
