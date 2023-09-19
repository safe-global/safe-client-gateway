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
  expirationTimeInSeconds: {
    default: faker.number.int(),
    notFound: {
      default: faker.number.int(),
      contract: faker.number.int(),
      token: faker.number.int(),
    },
  },
  features: {
    humanDescription: true,
    messagesCache: true,
  },
  httpClient: { requestTimeout: faker.number.int() },
  log: {
    level: 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  redis: {
    host: faker.internet.domainName(),
    port: faker.internet.port().toString(),
  },
  relay: { limit: faker.number.int({ min: 1 }) },
  safeConfig: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  safeTransaction: {
    useVpcUrl: false,
  },
});
