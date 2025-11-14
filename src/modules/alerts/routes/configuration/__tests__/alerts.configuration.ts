import { registerAs } from '@nestjs/config';
import { faker } from '@faker-js/faker';

export default registerAs('alerts-route', () => ({
  signingKey: faker.string.nanoid(32),
}));
