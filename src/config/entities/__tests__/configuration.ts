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
      10: { nativeCoin: 'optimism', chainName: 'optimistic-ethereum' },
      100: { nativeCoin: 'gnosis', chainName: 'xdai' },
      1101: { nativeCoin: 'matic-network', chainName: 'polygon-zkevm' },
      1313161554: { nativeCoin: 'aurora', chainName: 'aurora' },
      137: { nativeCoin: 'matic-network', chainName: 'polygon-pos' },
      324: { nativeCoin: 'ethereum', chainName: 'zksync' },
      42161: { nativeCoin: 'arbitrum', chainName: 'arbitrum-one' },
      42220: { nativeCoin: 'celo', chainName: 'celo' },
      43114: { nativeCoin: 'avalanche-2', chainName: 'avalanche' },
      56: { nativeCoin: 'binancecoin', chainName: 'binance-smart-chain' },
      8453: { nativeCoin: 'base', chainName: 'base' },
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
