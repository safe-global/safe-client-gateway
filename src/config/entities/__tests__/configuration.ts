import { faker } from '@faker-js/faker';

export default () => ({
  about: {
    name: faker.random.words(),
    version: faker.system.semver(),
    buildNumber: faker.random.numeric(),
  },
  applicationPort: faker.internet.port(),
  auth: {
    token: faker.datatype.hexadecimal(32),
  },
  exchange: {
    baseUri: faker.internet.url(),
    apiKey: faker.datatype.hexadecimal(32),
    cacheTtlSeconds: faker.random.numeric(),
  },
  safeConfig: {
    baseUri: faker.internet.url(),
  },
  safeTransaction: {
    useVpcUrl: false,
  },
  redis: {
    host: faker.internet.domainName(),
    port: faker.internet.port(),
  },
  expirationTimeInSeconds: {
    default: faker.random.numeric(),
  },
});
