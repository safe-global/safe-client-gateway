import { faker } from '@faker-js/faker';
import configuration from '@/config/entities/configuration';

export default (): ReturnType<typeof configuration> => ({
  about: {
    name: faker.word.words(),
    version: faker.system.semver(),
    buildNumber: faker.string.numeric(),
  },
  amqp: {
    url: faker.internet.url({ appendSlash: false }),
    exchange: { name: faker.string.sample(), mode: faker.string.sample() },
    queue: faker.string.sample(),
    prefetch: faker.number.int(),
  },
  applicationPort: faker.internet.port().toString(),
  auth: {
    token: faker.string.hexadecimal({ length: 32 }),
    nonceTtlSeconds: faker.number.int(),
    maxValidityPeriodSeconds: faker.number.int({ min: 1, max: 60 * 1_000 }),
  },
  balances: {
    balancesTtlSeconds: faker.number.int(),
    providers: {
      safe: {
        prices: {
          baseUri: faker.internet.url({ appendSlash: false }),
          apiKey: faker.string.hexadecimal({ length: 32 }),
          pricesTtlSeconds: faker.number.int(),
          nativeCoinPricesTtlSeconds: faker.number.int(),
          notFoundPriceTtlSeconds: faker.number.int(),
          highRefreshRateTokens: [],
          highRefreshRateTokensTtlSeconds: faker.number.int(),
        },
      },
      zerion: {
        apiKey: faker.string.hexadecimal({ length: 32 }),
        baseUri: faker.internet.url({ appendSlash: false }),
        chains: {
          1: { chainName: faker.string.sample() },
          10: { chainName: faker.string.sample() },
          100: { chainName: faker.string.sample() },
          1101: { chainName: faker.string.sample() },
          1313161554: { chainName: faker.string.sample() },
          137: { chainName: faker.string.sample() },
          324: { chainName: faker.string.sample() },
          42161: { chainName: faker.string.sample() },
          42220: { chainName: faker.string.sample() },
          43114: { chainName: faker.string.sample() },
          534352: { chainName: faker.string.sample() },
          56: { chainName: faker.string.sample() },
          8453: { chainName: faker.string.sample() },
        },
        currencies: Array.from(
          new Set([
            ...Array.from(
              { length: faker.number.int({ min: 2, max: 5 }) },
              () => faker.finance.currencyCode().toLowerCase(),
            ),
            'btc',
            'eth',
            'eur',
            'usd',
          ]),
        ),
        limitPeriodSeconds: faker.number.int({ min: 1, max: 10 }),
        limitCalls: faker.number.int({ min: 1, max: 5 }),
      },
    },
  },
  blockchain: {
    infura: {
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
  },
  db: {
    postgres: {
      host: process.env.POSTGRES_TEST_HOST || 'localhost',
      port: process.env.POSTGRES_TEST_PORT || '5433',
      database: process.env.POSTGRES_TEST_DB || 'test-db',
      username: process.env.POSTGRES_TEST_USER || 'postgres',
      password: process.env.POSTGRES_TEST_PASSWORD || 'postgres',
      ssl: {
        enabled: true,
        requestCert: true,
        rejectUnauthorized: true,
        caPath: process.env.POSTGRES_SSL_CA_PATH,
      },
    },
  },
  email: {
    applicationCode: faker.string.alphanumeric(),
    baseUri: faker.internet.url({ appendSlash: false }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
    fromEmail: faker.internet.email(),
    fromName: faker.person.fullName(),
  },
  expirationTimeInSeconds: {
    default: faker.number.int(),
    notFound: {
      default: faker.number.int(),
      contract: faker.number.int(),
      token: faker.number.int(),
    },
  },
  express: { jsonLimit: '1mb' },
  features: {
    richFragments: true,
    email: false,
    zerionBalancesChainIds: ['137'],
    swapsDecoding: true,
    twapsDecoding: true,
    historyDebugLogs: false,
    imitationMapping: false,
    auth: false,
    confirmationView: false,
    eventsQueue: false,
    delegatesV2: false,
    counterfactualBalances: false,
    accounts: false,
  },
  httpClient: { requestTimeout: faker.number.int() },
  locking: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  log: {
    level: 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  mappings: {
    imitation: {
      lookupDistance: faker.number.int(),
      prefixLength: faker.number.int(),
      suffixLength: faker.number.int(),
    },
    history: {
      maxNestedTransfers: faker.number.int({ min: 1, max: 5 }),
    },
    safe: {
      maxOverviews: faker.number.int({ min: 1, max: 5 }),
    },
  },
  owners: {
    ownersTtlSeconds: faker.number.int(),
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  relay: {
    baseUri: faker.internet.url({ appendSlash: false }),
    limit: faker.number.int({ min: 1 }),
    ttlSeconds: faker.number.int(),
    apiKey: {
      100: faker.string.hexadecimal({ length: 32 }),
      42161: faker.string.hexadecimal({ length: 32 }),
      11155111: faker.string.hexadecimal({ length: 32 }),
    },
  },
  safeConfig: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  safeTransaction: {
    useVpcUrl: false,
  },
  safeWebApp: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  swaps: {
    api: {
      1: faker.internet.url(),
      100: faker.internet.url(),
      42161: faker.internet.url(),
      11155111: faker.internet.url(),
    },
    explorerBaseUri: faker.internet.url(),
    restrictApps: false,
    allowedApps: [],
  },
});
