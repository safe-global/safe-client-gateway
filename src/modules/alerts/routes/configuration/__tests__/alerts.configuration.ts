import { faker } from '@faker-js/faker';
import { registerAs } from '@nestjs/config';

export default registerAs('alerts-route', () => ({
  signingKey: faker.string.nanoid(32),
}));
