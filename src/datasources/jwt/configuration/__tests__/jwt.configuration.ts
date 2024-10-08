import { registerAs } from '@nestjs/config';
import { faker } from '@faker-js/faker';
import type { JwtConfiguration } from '@/datasources/jwt/configuration/jwt.configuration';

export default registerAs(
  'jwt',
  (): JwtConfiguration => ({
    issuer: faker.lorem.word(),
    secret: faker.string.alphanumeric(),
  }),
);
