import { faker } from '@faker-js/faker';
import configuration from '@/config/entities/configuration';

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
  db: {
    postgres: {
      host: faker.internet.ip(),
      port: faker.internet.port().toString(),
      database: faker.word.sample(),
      username: faker.internet.userName(),
      password: faker.internet.password(),
    },
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
    pricesProviderChainIds: ['10'],
    humanDescription: true,
    messagesCache: true,
  },
  httpClient: { requestTimeout: faker.number.int() },
  log: {
    level: 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  prices: {
    baseUri:
      process.env.PRICES_PROVIDER_API_BASE_URI ||
      'https://api.coingecko.com/api/v3',
    apiKey: process.env.PRICES_PROVIDER_API_KEY,
    pricesTtlSeconds: parseInt(process.env.PRICES_TTL_SECONDS ?? `${300}`),
    chains: {
      1: { nativeCoin: 'ethereum', chainName: 'ethereum' },
      10: { nativeCoin: 'ethereum', chainName: 'optimistic-ethereum' },
      100: { nativeCoin: 'gnosis', chainName: 'xdai' },
      1101: { nativeCoin: 'ethereum', chainName: 'polygon-zkevm' },
      1313161554: { nativeCoin: 'ethereum', chainName: 'aurora' },
      137: { nativeCoin: 'matic-network', chainName: 'polygon-pos' },
      324: { nativeCoin: 'ethereum', chainName: 'zksync' },
      42161: { nativeCoin: 'ethereum', chainName: 'arbitrum-one' },
      42220: { nativeCoin: 'celo', chainName: 'celo' },
      43114: { nativeCoin: 'avalanche-2', chainName: 'avalanche' },
      5: { nativeCoin: 'ethereum', chainName: 'ethereum' },
      56: { nativeCoin: 'binancecoin', chainName: 'binance-smart-chain' },
      8453: { nativeCoin: 'ethereum', chainName: 'base' },
    },
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
