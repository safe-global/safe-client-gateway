import { faker } from '@faker-js/faker';
import configuration from '../../entities/configuration';

export default (): ReturnType<typeof configuration> => ({
  about: {
    name: faker.word.words(),
    version: faker.system.semver(),
    buildNumber: faker.string.numeric(),
  },
  applicationPort: faker.internet.port().toString(),
  auth: {
    token: faker.string.hexadecimal({ length: 32 }),
  },
  exchange: {
    baseUri: faker.internet.url({ appendSlash: false }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
    cacheTtlSeconds: faker.number.int(),
  },
  safeConfig: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  safeTransaction: {
    useVpcUrl: false,
  },
  redis: {
    host: faker.internet.domainName(),
    port: faker.internet.port().toString(),
  },
  expirationTimeInSeconds: {
    default: faker.number.int(),
  },
  httpClient: { requestTimeout: faker.number.int() },
});
