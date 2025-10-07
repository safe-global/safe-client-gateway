import { faker } from '@faker-js/faker';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => {
  process.env.TZ = 'UTC';
  // Seed faker for deterministic random values across test runs
  faker.seed(12345);
};
