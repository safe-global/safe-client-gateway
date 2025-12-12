import { faker } from '@faker-js/faker';
import type configuration from '@/config/entities/configuration';
import { getAddress } from 'viem';

export default (): ReturnType<typeof configuration> => ({
  about: {
    name: faker.word.words(),
    version: faker.system.semver(),
    buildNumber: faker.string.numeric(),
  },
  accounts: {
    creationRateLimitPeriodSeconds: faker.number.int(),
    creationRateLimitCalls: faker.number.int(),
    counterfactualSafes: {
      creationRateLimitPeriodSeconds: faker.number.int(),
      creationRateLimitCalls: faker.number.int(),
    },
    encryption: {
      type: faker.string.sample(),
      awsKms: {
        algorithm: faker.string.alphanumeric(),
        keyId: faker.string.uuid(),
      },
      local: {
        algorithm: faker.string.alphanumeric(),
        key: faker.string.alphanumeric(),
        iv: faker.string.alphanumeric(),
      },
    },
  },
  amqp: {
    url: faker.internet.url({ appendSlash: false }),
    exchange: { name: faker.string.sample(), mode: faker.string.sample() },
    queue: faker.string.sample(),
    prefetch: faker.number.int(),
    heartbeatIntervalInSeconds: 60,
    reconnectTimeInSeconds: 5,
  },
  application: {
    isProduction: faker.datatype.boolean(),
    isDevelopment: faker.datatype.boolean(),
    runMigrations: true,
    port: faker.internet.port().toString(),
    allowCors: faker.datatype.boolean(),
  },
  auth: {
    token: faker.string.hexadecimal({ length: 32 }),
    nonceTtlSeconds: faker.number.int(),
    maxValidityPeriodSeconds: faker.number.int({ min: 1, max: 60 * 1_000 }),
  },
  balances: {
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
              () => faker.finance.currencyCode(),
            ),
            'BTC',
            'ETH',
            'EUR',
            'USD',
          ]),
        ),
        limitPeriodSeconds: faker.number.int({ min: 1, max: 10 }),
        limitCalls: faker.number.int({ min: 1, max: 5 }),
      },
    },
  },
  portfolio: {
    cache: {
      ttlSeconds: faker.number.int({ min: 10, max: 300 }),
    },
    filters: {
      dustThresholdUsd: faker.number.float({ min: 0.1, max: 10 }),
    },
  },
  blockchain: {
    blocklist: faker.helpers.multiple(
      () => getAddress(faker.finance.ethereumAddress()),
      { count: { min: 1, max: 5 } },
    ),
    infura: {
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
  },
  bridge: {
    baseUri: faker.internet.url({ appendSlash: false }),
    apiKey: faker.string.hexadecimal({ length: 32 }),
  },
  contracts: {
    trustedForDelegateCall: {
      maxSequentialPages: faker.number.int({ min: 1, max: 5 }),
    },
  },
  db: {
    migrator: {
      executeMigrations: true,
      numberOfRetries: process.env.DB_TEST_MIGRATIONS_NUMBER_OF_RETRIES ?? 5,
      retryAfterMs: process.env.DB_TEST_MIGRATIONS_RETRY_AFTER_MS ?? 1000, // Milliseconds
    },
    orm: {
      autoLoadEntities: true,
      manualInitialization: true,
      migrationsRun: false,
      migrationsTableName: '_migrations',
      cache: false,
    },
    connection: {
      postgres: {
        schema: process.env.POSTGRES_SCHEMA || 'main',
        host: process.env.POSTGRES_TEST_HOST || 'localhost',
        port: process.env.POSTGRES_TEST_PORT || '5433',
        database: process.env.POSTGRES_TEST_DB || 'test-db',
        username: process.env.POSTGRES_TEST_USER || 'postgres',
        password: process.env.POSTGRES_TEST_PASSWORD || 'postgres',
        ssl: {
          enabled: true,
          requestCert: true,
          rejectUnauthorized: true,
          caPath:
            process.env.POSTGRES_SSL_CA_PATH || 'db_config/test/server.crt',
        },
      },
    },
  },
  earn: {
    testnet: {
      baseUri: faker.internet.url({ appendSlash: false }),
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
    mainnet: {
      baseUri: faker.internet.url({ appendSlash: false }),
      apiKey: faker.string.hexadecimal({ length: 32 }),
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
    deviatePercent: faker.number.int({ min: 10, max: 20 }),
    default: faker.number.int(),
    rpc: faker.number.int(),
    hoodi: faker.number.int(),
    indexing: faker.number.int(),
    staking: faker.number.int(),
    zerionPositions: faker.number.int(),
    notFound: {
      default: faker.number.int(),
      contract: faker.number.int(),
      token: faker.number.int(),
    },
  },
  express: { jsonLimit: '1mb' },
  features: {
    email: false,
    zerionBalancesChainIds: ['137'],
    zerionPositions: false,
    debugLogs: false,
    configHooksDebugLogs: false,
    auth: false,
    counterfactualBalances: false,
    accounts: false,
    users: false,
    hookHttpPostEvent: false,
    improvedAddressPoisoning: false,
    signatureVerification: {
      api: true,
      proposal: true,
    },
    hashVerification: {
      api: true,
      proposal: true,
    },
    messageVerification: true,
    ethSign: true,
    trustedDelegateCall: false,
    trustedForDelegateCallContractsList: false,
    filterValueParsing: false,
    vaultTransactionsMapping: false,
    lifiTransactionsMapping: false,
    cacheInFlightRequests: false,
  },
  httpClient: {
    requestTimeout: faker.number.int(),
    ownersTimeout: faker.number.int(),
  },
  locking: {
    baseUri: faker.internet.url({ appendSlash: false }),
    eligibility: {
      fingerprintEncryptionKey: faker.string.uuid(),
      nonEligibleCountryCodes: faker.helpers.multiple(
        () => faker.location.countryCode(),
        { count: { min: 1, max: 5 } },
      ),
    },
  },
  jwt: {
    issuer: process.env.JWT_TEST_ISSUER || 'dummy-issuer',
    secret: process.env.JWT_TEST_SECRET || 'dummy-secret',
  },
  log: {
    level: 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
    prettyColorize: process.env.LOG_PRETTY_COLORIZE?.toLowerCase() === 'true',
  },
  mappings: {
    imitation: {
      lookupDistance: faker.number.int(),
      prefixLength: faker.number.int(),
      suffixLength: faker.number.int(),
      valueTolerance: faker.number.bigInt(),
      echoLimit: faker.number.bigInt(),
    },
    history: {
      maxNestedTransfers: faker.number.int({ min: 1, max: 5 }),
    },
    transactionData: {
      maxTokenInfoIndexSize: faker.number.int({ min: 1, max: 5 }),
    },
    safe: {
      maxOverviews: faker.number.int({ min: 1, max: 5 }),
    },
  },
  owners: {
    ownersTtlSeconds: faker.number.int(),
  },
  pushNotifications: {
    baseUri: faker.internet.url({ appendSlash: false }),
    project: faker.word.noun(),
    serviceAccount: {
      clientEmail: faker.internet.email(),
      privateKey: faker.string.alphanumeric(),
    },
    getSubscribersBySafeTtlMilliseconds: faker.number.int({ min: 1, max: 100 }),
    oauth2TokenTtlBufferInSeconds: faker.number.int({ min: 30, max: 100 }),
  },
  redis: {
    user: process.env.REDIS_USER,
    pass: process.env.REDIS_PASS,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
    disableOfflineQueue:
      process.env.REDIS_DISABLE_OFFLINE_QUEUE?.toString() === 'true',
    connectTimeout: process.env.REDIS_CONNECT_TIMEOUT || 10_000,
    keepAlive: process.env.REDIS_KEEP_ALIVE || 30_000,
  },
  relay: {
    baseUri: faker.internet.url({ appendSlash: false }),
    limit: faker.number.int({ min: 1 }),
    ttlSeconds: faker.number.int(),
    apiKey: {
      1: faker.string.hexadecimal({ length: 32 }),
      10: faker.string.hexadecimal({ length: 32 }),
      56: faker.string.hexadecimal({ length: 32 }),
      100: faker.string.hexadecimal({ length: 32 }),
      137: faker.string.hexadecimal({ length: 32 }),
      1101: faker.string.hexadecimal({ length: 32 }),
      8453: faker.string.hexadecimal({ length: 32 }),
      42161: faker.string.hexadecimal({ length: 32 }),
      43114: faker.string.hexadecimal({ length: 32 }),
      59144: faker.string.hexadecimal({ length: 32 }),
      81457: faker.string.hexadecimal({ length: 32 }),
      11155111: faker.string.hexadecimal({ length: 32 }),
    },
    dailyLimitRelayerChainsIds: [],
    noFeeCampaign: {
      1: {
        startsAtTimeStamp: new Date().getTime() / 1000 - 10_000,
        endsAtTimeStamp: new Date().getTime() / 1000 + 1_000_000,
        safeTokenAddress: faker.finance.ethereumAddress(),
        maxGasLimit: faker.number.int({ min: 1 }),
        relayRules: [
          {
            balanceMin: BigInt(0),
            balanceMax: BigInt(100) * BigInt(10) ** BigInt(18) - BigInt(1),
            limit: 0,
          },
          {
            balanceMin: BigInt(100) * BigInt(10) ** BigInt(18),
            balanceMax: BigInt(1000) * BigInt(10) ** BigInt(18) - BigInt(1),
            limit: 1,
          },
          {
            balanceMin: BigInt(1000) * BigInt(10) ** BigInt(18),
            balanceMax: BigInt(10000) * BigInt(10) ** BigInt(18) - BigInt(1),
            limit: 10,
          },
          {
            balanceMin: BigInt(10000) * BigInt(10) ** BigInt(18),
            balanceMax:
              BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10) ** BigInt(18),
            limit: 100,
          },
        ],
      },
      11155111: {
        startsAtTimeStamp: new Date().getTime() / 1000 - 10_000,
        endsAtTimeStamp: new Date().getTime() / 1000 + 1000_000,
        maxGasLimit: faker.number.int({ min: 1 }),
        safeTokenAddress: faker.finance.ethereumAddress(),
        relayRules: [
          {
            balanceMin: BigInt(0),
            balanceMax: BigInt(99) * BigInt(10) ** BigInt(18),
            limit: 0,
          },
          {
            balanceMin: BigInt(100) * BigInt(10) ** BigInt(18),
            balanceMax: BigInt(1000) * BigInt(10) ** BigInt(18) - BigInt(1),
            limit: 1,
          },
          {
            balanceMin: BigInt(1000) * BigInt(10) ** BigInt(18),
            balanceMax: BigInt(10000) * BigInt(10) ** BigInt(18) - BigInt(1),
            limit: 10,
          },
          {
            balanceMin: BigInt(10000) * BigInt(10) ** BigInt(18),
            balanceMax:
              BigInt(Number.MAX_SAFE_INTEGER) * BigInt(10) ** BigInt(18),
            limit: 100,
          },
        ],
      },
    },
  },
  safeConfig: {
    baseUri: faker.internet.url({ appendSlash: false }),
    chains: {
      maxSequentialPages: faker.number.int(),
    },
  },
  safeDataDecoder: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  safeTransaction: {
    useVpcUrl: false,
    apiKey: faker.string.hexadecimal({ length: 32 }),
  },
  safeWebApp: {
    baseUri: faker.internet.url({ appendSlash: false }),
  },
  spaces: {
    addressBooks: {
      maxItems: faker.number.int({ min: 10, max: 20 }),
    },
    maxSafesPerSpace: faker.number.int({ min: 5, max: 10 }),
    maxSpaceCreationsPerUser: faker.number.int({ min: 100, max: 200 }),
    maxInvites: faker.number.int({ min: 5, max: 10 }),
    rateLimit: {
      creation: {
        max: faker.number.int({ min: 100, max: 200 }),
        windowSeconds: faker.number.int({ min: 100, max: 200 }),
      },
      addressBookUpsertion: {
        max: faker.number.int({ min: 100, max: 200 }),
        windowSeconds: faker.number.int({ min: 100, max: 200 }),
      },
    },
  },
  staking: {
    testnet: {
      baseUri: faker.internet.url({ appendSlash: false }),
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
    mainnet: {
      baseUri: faker.internet.url({ appendSlash: false }),
      apiKey: faker.string.hexadecimal({ length: 32 }),
    },
  },
  swaps: {
    api: {
      1: faker.internet.url({ appendSlash: false }),
      56: faker.internet.url({ appendSlash: false }),
      100: faker.internet.url({ appendSlash: false }),
      137: faker.internet.url({ appendSlash: false }),
      8453: faker.internet.url({ appendSlash: false }),
      232: faker.internet.url({ appendSlash: false }),
      42161: faker.internet.url({ appendSlash: false }),
      43114: faker.internet.url({ appendSlash: false }),
      11155111: faker.internet.url({ appendSlash: false }),
      59144: faker.internet.url({ appendSlash: false }),
    },
    explorerBaseUri: faker.internet.url({ appendSlash: true }),
    restrictApps: false,
    allowedApps: [],
    maxNumberOfParts: faker.number.int(),
  },
  targetedMessaging: {
    fileStorage: {
      type: 'local',
      aws: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
        bucketName: faker.string.alphanumeric(),
        basePath: faker.system.directoryPath(),
      },
      local: {
        baseDir: 'assets/targeted-messaging',
      },
    },
  },
  csvExport: {
    fileStorage: {
      type: 'local',
      aws: {
        accessKeyId: 'dummy',
        secretAccessKey: 'dummy',
        bucketName: faker.string.alphanumeric(),
        basePath: faker.system.directoryPath(),
      },
      local: {
        baseDir: 'assets/csv-export',
      },
    },
    signedUrlTtlSeconds: faker.number.int(),
    queue: {
      removeOnComplete: {
        age: faker.number.int({ min: 0, max: 10000 }),
        count: faker.number.int({ min: 0, max: 10 }),
      },
      removeOnFail: {
        age: faker.number.int({ min: 0, max: 10000 }),
        count: faker.number.int({ min: 0, max: 10 }),
      },
      backoff: {
        type: 'exponential',
        delay: faker.number.int({ min: 0, max: 2000 }),
      },
      attempts: faker.number.int({ min: 0, max: 3 }),
      concurrency: faker.number.int({ min: 1, max: 5 }),
    },
  },
  safeShield: {
    threatAnalysis: {
      blockaid: {
        apiKey: faker.string.hexadecimal({ length: 32 }),
      },
    },
  },
});
