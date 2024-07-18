// Custom configuration for the application
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  amqp: {
    url: process.env.AMQP_URL || 'amqp://localhost:5672',
    exchange: {
      name: process.env.AMQP_EXCHANGE_NAME || 'safe-transaction-service-events',
      // The Safe Transaction Service AMQP Exchange mode defaults to 'fanout'.
      // https://www.rabbitmq.com/tutorials/amqp-concepts#exchange-fanout
      // A fanout exchange routes messages to all of the queues that are bound to it and the routing key is ignored.
      mode: process.env.AMQP_EXCHANGE_MODE || 'fanout',
    },
    queue: process.env.AMQP_QUEUE || 'safe-client-gateway',
    // The AMQP Prefetch value defaults to 0.
    // Limits the number of unacknowledged messages delivered to a given channel/consumer.
    prefetch:
      process.env.AMQP_PREFETCH != null
        ? parseInt(process.env.AMQP_PREFETCH)
        : 100,
  },
  application: {
    isProduction: process.env.CGW_ENV === 'production',
    // Enables/disables the execution of migrations on startup.
    // Defaults to true.
    runMigrations: process.env.RUN_MIGRATIONS?.toLowerCase() !== 'false',
    port: process.env.APPLICATION_PORT || '3000',
  },
  auth: {
    token: process.env.AUTH_TOKEN,
    nonceTtlSeconds: parseInt(
      process.env.AUTH_NONCE_TTL_SECONDS ?? `${5 * 60}`,
    ),
    maxValidityPeriodSeconds: parseInt(
      process.env.AUTH_VALIDITY_PERIOD_SECONDS ?? `${15 * 60}`,
    ),
  },
  balances: {
    providers: {
      safe: {
        prices: {
          baseUri:
            process.env.PRICES_PROVIDER_API_BASE_URI ||
            'https://api.coingecko.com/api/v3',
          apiKey: process.env.PRICES_PROVIDER_API_KEY,
          pricesTtlSeconds: parseInt(
            process.env.PRICES_TTL_SECONDS ?? `${300}`,
          ),
          nativeCoinPricesTtlSeconds: parseInt(
            process.env.NATIVE_COINS_PRICES_TTL_SECONDS ?? `${100}`,
          ),
          notFoundPriceTtlSeconds: parseInt(
            process.env.NOT_FOUND_PRICE_TTL_SECONDS ?? `${72 * 60 * 60}`,
          ),
          highRefreshRateTokens:
            process.env.HIGH_REFRESH_RATE_TOKENS?.split(',') ?? [],
          highRefreshRateTokensTtlSeconds: parseInt(
            process.env.HIGH_REFRESH_RATE_TOKENS_TTL_SECONDS ?? `${30}`,
          ),
        },
      },
      zerion: {
        apiKey: process.env.ZERION_API_KEY,
        baseUri: process.env.ZERION_BASE_URI || 'https://api.zerion.io',
        chains: {
          1: { chainName: 'ethereum' },
          10: { chainName: 'optimism' },
          100: { chainName: 'xdai' },
          1101: { chainName: 'polygon-zkevm' },
          1313161554: { chainName: 'aurora' },
          137: { chainName: 'polygon' },
          324: { chainName: 'zksync-era' },
          42161: { chainName: 'arbitrum' },
          42220: { chainName: 'celo' },
          43114: { chainName: 'avalanche' },
          534352: { chainName: 'scroll' },
          56: { chainName: 'binance-smart-chain' },
          8453: { chainName: 'base' },
        },
        currencies: [
          'usd',
          'eur',
          'eth',
          'aud',
          'btc',
          'cad',
          'chf',
          'cny',
          'gbp',
          'inr',
          'jpy',
          'krw',
          'nzd',
          'rub',
          'try',
          'zar',
        ],
        limitPeriodSeconds: parseInt(
          process.env.ZERION_RATE_LIMIT_PERIOD_SECONDS ?? `${10}`,
        ),
        limitCalls: parseInt(
          process.env.ZERION_RATE_LIMIT_CALLS_BY_PERIOD ?? `${2}`,
        ),
      },
    },
  },
  blockchain: {
    infura: {
      apiKey: process.env.INFURA_API_KEY,
    },
  },
  db: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || '5432',
      database: process.env.POSTGRES_DB || 'safe-client-gateway',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      ssl: {
        enabled: process.env.POSTGRES_SSL_ENABLED?.toLowerCase() === 'true',
        requestCert:
          process.env.POSTGRES_SSL_REQUEST_CERT?.toLowerCase() !== 'false',
        // If the value is not explicitly set to false, default should be true
        // If not false the server will reject any connection which is not authorized with the list of supplied CAs
        // https://nodejs.org/docs/latest-v20.x/api/tls.html#tlscreateserveroptions-secureconnectionlistener
        rejectUnauthorized:
          process.env.POSTGRES_SSL_REJECT_UNAUTHORIZED?.toLowerCase() !==
          'false',
        caPath: process.env.POSTGRES_SSL_CA_PATH,
      },
    },
  },
  email: {
    applicationCode: process.env.EMAIL_API_APPLICATION_CODE,
    baseUri: process.env.EMAIL_API_BASE_URI || 'https://api.pushwoosh.com',
    apiKey: process.env.EMAIL_API_KEY,
    fromEmail: process.env.EMAIL_API_FROM_EMAIL,
    fromName: process.env.EMAIL_API_FROM_NAME || 'Safe',
  },
  expirationTimeInSeconds: {
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
    notFound: {
      default: parseInt(
        process.env.DEFAULT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${30}`,
      ),
      contract: parseInt(
        process.env.CONTRACT_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${60}`,
      ),
      token: parseInt(
        process.env.TOKEN_NOT_FOUND_EXPIRE_TIME_SECONDS ?? `${60}`,
      ),
    },
  },
  express: {
    // Controls the maximum request body size. If this is a number, then the value
    // specifies the number of bytes; if it is a string, the value is passed to the
    // bytes library for parsing. Defaults to '100kb'.
    // https://expressjs.com/en/resources/middleware/body-parser.html
    jsonLimit: process.env.EXPRESS_JSON_LIMIT ?? '1mb',
  },
  features: {
    richFragments: process.env.FF_RICH_FRAGMENTS?.toLowerCase() === 'true',
    email: process.env.FF_EMAIL?.toLowerCase() === 'true',
    zerionBalancesChainIds:
      process.env.FF_ZERION_BALANCES_CHAIN_IDS?.split(',') ?? [],
    swapsDecoding: process.env.FF_SWAPS_DECODING?.toLowerCase() === 'true',
    twapsDecoding: process.env.FF_TWAPS_DECODING?.toLowerCase() === 'true',
    debugLogs: process.env.FF_DEBUG_LOGS?.toLowerCase() === 'true',
    imitationMapping:
      process.env.FF_IMITATION_MAPPING?.toLowerCase() === 'true',
    auth: process.env.FF_AUTH?.toLowerCase() === 'true',
    confirmationView:
      process.env.FF_CONFIRMATION_VIEW?.toLowerCase() === 'true',
    eventsQueue: process.env.FF_EVENTS_QUEUE?.toLowerCase() === 'true',
    delegatesV2: process.env.FF_DELEGATES_V2?.toLowerCase() === 'true',
    counterfactualBalances:
      process.env.FF_COUNTERFACTUAL_BALANCES?.toLowerCase() === 'true',
    accounts: process.env.FF_ACCOUNTS?.toLowerCase() === 'true',
  },
  httpClient: {
    // Timeout in milliseconds to be used for the HTTP client.
    // A value of 0 disables the timeout.
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
  locking: {
    baseUri:
      process.env.LOCKING_PROVIDER_API_BASE_URI ||
      'https://safe-locking.safe.global',
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  owners: {
    // There is no hook to invalidate the owners, so defaulting 0 disables the cache
    ownersTtlSeconds: parseInt(process.env.OWNERS_TTL_SECONDS ?? `${0}`),
  },
  mappings: {
    imitation: {
      lookupDistance: parseInt(process.env.IMITATION_LOOKUP_DISTANCE ?? `${3}`),
      prefixLength: parseInt(process.env.IMITATION_PREFIX_LENGTH ?? `${3}`),
      suffixLength: parseInt(process.env.IMITATION_SUFFIX_LENGTH ?? `${4}`),
    },
    history: {
      maxNestedTransfers: parseInt(
        process.env.MAX_NESTED_TRANSFERS ?? `${100}`,
      ),
    },
    safe: {
      maxOverviews: parseInt(process.env.MAX_SAFE_OVERVIEWS ?? `${10}`),
    },
  },
  pushNotifications: {
    baseUri:
      process.env.PUSH_NOTIFICATIONS_API_BASE_URI ||
      'https://fcm.googleapis.com/v1/projects',
    project: process.env.PUSH_NOTIFICATIONS_API_PROJECT,
    serviceAccount: {
      clientEmail:
        process.env.PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_CLIENT_EMAIL,
      privateKey:
        process.env.PUSH_NOTIFICATIONS_API_SERVICE_ACCOUNT_PRIVATE_KEY,
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  relay: {
    baseUri:
      process.env.RELAY_PROVIDER_API_BASE_URI || 'https://api.gelato.digital',
    limit: parseInt(process.env.RELAY_THROTTLE_LIMIT ?? `${5}`),
    ttlSeconds: parseInt(
      process.env.RELAY_THROTTLE_TTL_SECONDS ?? `${60 * 60}`,
    ),
    apiKey: {
      100: process.env.RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN,
      42161: process.env.RELAY_PROVIDER_API_KEY_ARBITRUM_ONE,
      11155111: process.env.RELAY_PROVIDER_API_KEY_SEPOLIA,
    },
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
  safeWebApp: {
    baseUri: process.env.SAFE_WEB_APP_BASE_URI || 'https://app.safe.global',
  },
  swaps: {
    api: {
      1: 'https://api.cow.fi/mainnet',
      100: 'https://api.cow.fi/xdai',
      42161: 'https://api.cow.fi/arbitrum_one',
      11155111: 'https://api.cow.fi/sepolia',
    },
    explorerBaseUri:
      process.env.SWAPS_EXPLORER_URI || 'https://explorer.cow.fi/',
    // If set to true, it will restrict the Swap Feature to be used only
    // with Apps contained in allowedApps
    restrictApps: process.env.SWAPS_RESTRICT_APPS?.toLowerCase() === 'true',
    // The comma-separated collection of allowed CoW Swap Apps.
    // In order for this collection to take effect, restrictApps should be set to true
    // The app names should match the "App Code" of the metadata provided to CoW Swap.
    // See https://explorer.cow.fi/appdata?tab=encode
    allowedApps: process.env.SWAPS_ALLOWED_APPS?.split(',') || [],
    // Upper limit of parts we will request from CoW for TWAP orders, after
    // which we return base values for those orders
    // Note: 11 is the average number of parts, confirmed by CoW
    maxNumberOfParts: parseInt(
      process.env.SWAPS_MAX_NUMBER_OF_PARTS ?? `${11}`,
    ),
  },
});
