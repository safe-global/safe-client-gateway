import { faker } from '@faker-js/faker';
import configuration from '../../entities/configuration';

export default (): ReturnType<typeof configuration> => ({
  about: {
    name: faker.random.words(),
    version: faker.system.semver(),
    buildNumber: faker.random.numeric(),
  },
  applicationPort: faker.internet.port().toString(),
  auth: {
    token: faker.datatype.hexadecimal(32),
  },
  exchange: {
    baseUri: faker.internet.url(),
    apiKey: faker.datatype.hexadecimal(32),
    cacheTtlSeconds: faker.datatype.number(),
  },
  safeConfig: {
    baseUri: faker.internet.url(),
  },
  safeTransaction: {
    useVpcUrl: false,
  },
  redis: {
    host: faker.internet.domainName(),
    port: faker.internet.port().toString(),
  },
  expirationTimeInSeconds: {
    default: faker.datatype.number(),
  },
});
