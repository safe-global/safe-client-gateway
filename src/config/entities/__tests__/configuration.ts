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
  chains: {
    knownImplementations: [
      { chainId: '1', implementationName: 'ethereum' },
      { chainId: '42161', implementationName: 'arbitrum' },
      { chainId: '1313161554', implementationName: 'aurora' },
      { chainId: '43114', implementationName: 'avalanche' },
      { chainId: '8453', implementationName: 'base' },
      { chainId: '56', implementationName: 'binance-smart-chain' },
      { chainId: '10', implementationName: 'optimism' },
      { chainId: '137', implementationName: 'polygon' },
      { chainId: '100', implementationName: 'xdai' },
      { chainId: '324', implementationName: 'zksync-era' },
    ],
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
  portfoliosProvider: {
    apiKey: 'notProvided',
    baseUri: faker.internet.url({ appendSlash: false }),
    currencies: [
      faker.finance.currencyCode(),
      faker.finance.currencyCode(),
      faker.finance.currencyCode(),
    ],
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
