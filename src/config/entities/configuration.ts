import { getBlocklist } from '@/config/entities/blocklist.config';
import type { RelayRules } from '@/domain/relay/entities/relay.configuration';
import { randomBytes } from 'crypto';

// Custom configuration for the application
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  accounts: {
    creationRateLimitPeriodSeconds: parseInt(
      process.env.ACCOUNT_CREATION_RATE_LIMIT_PERIOD_SECONDS ?? `${3600}`,
    ),
    creationRateLimitCalls: parseInt(
      process.env.ACCOUNT_CREATION_RATE_LIMIT_CALLS_BY_PERIOD ?? `${25}`,
    ),
    counterfactualSafes: {
      creationRateLimitPeriodSeconds: parseInt(
        process.env.COUNTERFACTUAL_SAFES_CREATION_RATE_LIMIT_PERIOD_SECONDS ??
          `${3600}`,
      ),
      creationRateLimitCalls: parseInt(
        process.env.COUNTERFACTUAL_SAFES_CREATION_RATE_LIMIT_CALLS_BY_PERIOD ??
          `${25}`,
      ),
    },
    encryption: {
      // The encryption type to use. Defaults to 'local'.
      // Supported values: 'aws', 'local'
      type: process.env.ACCOUNTS_ENCRYPTION_TYPE || 'local',
      awsKms: {
        keyId: process.env.AWS_KMS_ENCRYPTION_KEY_ID,
        algorithm: process.env.AWS_KMS_ENCRYPTION_ALGORITHM || 'aes-256-cbc',
      },
      local: {
        algorithm: process.env.LOCAL_ENCRYPTION_ALGORITHM || 'aes-256-cbc',
        key:
          process.env.LOCAL_ENCRYPTION_KEY || randomBytes(32).toString('hex'),
        iv: process.env.LOCAL_ENCRYPTION_IV || randomBytes(16).toString('hex'),
      },
    },
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
    heartbeatIntervalInSeconds: +(
      process.env.AMQP_HEARBEAT_INTERVAL_SECONDS || 60
    ),
    reconnectTimeInSeconds: +(process.env.AMQP_RECONNECT_TIME_SECONDS || 5),
  },
  application: {
    isProduction: process.env.CGW_ENV === 'production',
    isDevelopment: process.env.CGW_ENV === 'development',
    // Enables/disables the execution of migrations on startup.
    // Defaults to true.
    runMigrations: process.env.RUN_MIGRATIONS?.toLowerCase() !== 'false',
    port: process.env.APPLICATION_PORT || '3000',
    allowCors: process.env.ALLOW_CORS?.toLowerCase() === 'true',
  },
  auth: {
    token: process.env.AUTH_TOKEN,
    nonceTtlSeconds: parseInt(
      process.env.AUTH_NONCE_TTL_SECONDS ?? `${5 * 60}`,
    ),
    maxValidityPeriodSeconds: parseInt(
      process.env.AUTH_VALIDITY_PERIOD_SECONDS ?? `${24 * 60 * 60}`, // 24 hours
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
  portfolio: {
    cache: {
      ttlSeconds: parseInt(process.env.PORTFOLIO_CACHE_TTL_SECONDS ?? `${30}`),
    },
    filters: {
      dustThresholdUsd: parseFloat(
        process.env.PORTFOLIO_DUST_THRESHOLD_USD ?? '1.0',
      ),
    },
    providers: {
      zerion: {
        apiKey: process.env.ZERION_API_KEY,
        baseUri: process.env.ZERION_BASE_URI || 'https://api.zerion.io',
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
      },
    },
  },
  blockchain: {
    blocklist: getBlocklist(),
    infura: {
      apiKey: process.env.INFURA_API_KEY,
    },
  },
  bridge: {
    baseUri: 'https://li.quest',
    apiKey: process.env.BRIDGE_API_KEY,
  },
  contracts: {
    trustedForDelegateCall: {
      maxSequentialPages: parseInt(
        process.env.TRUSTED_CONTRACTS_MAX_SEQUENTIAL_PAGES ?? `${3}`,
      ),
    },
  },
  db: {
    migrator: {
      // Determines if database migrations should be executed. By default, it will execute
      executeMigrations:
        process.env.DB_MIGRATIONS_EXECUTE?.toLowerCase() !== 'false',
      // The number of times to retry running migrations in case of failure. Defaults to 5 retries.
      numberOfRetries: process.env.DB_MIGRATIONS_NUMBER_OF_RETRIES ?? 5,
      // The time interval (in milliseconds) to wait before retrying a failed migration. Defaults to 1000ms (1 second).
      retryAfterMs: process.env.DB_MIGRATIONS_RETRY_AFTER_MS ?? 1000, // Milliseconds
    },
    orm: {
      // Indicates if migrations should be automatically run when the ORM initializes. Set to false to control this behavior manually.
      migrationsRun: false,
      // Enables the automatic loading of entities into the ORM.
      autoLoadEntities: true,
      // Requires manual initialization of the database connection. Useful for controlling startup behavior.
      manualInitialization: true,
      // The name of the table where migrations are stored. Uses the environment variable value or defaults to '_migrations'.
      migrationsTableName:
        process.env.ORM_MIGRATION_TABLE_NAME || '_migrations',
      cache:
        process.env.ORM_CACHE_ENABLED?.toLowerCase() === 'true'
          ? {
              type: 'redis',
              options: {
                socket: {
                  host: process.env.REDIS_HOST || 'localhost',
                  port: process.env.REDIS_PORT || '6379',
                },
                username: process.env.REDIS_USER,
                password: process.env.REDIS_PASS,
              },
              duration: parseInt(process.env.ORM_CACHE_DURATION ?? `${1000}`),
              /**
               * @todo Fix the underlying issue with the Redis client shutting down
               */
              ignoreErrors: true,
            }
          : false,
    },
    connection: {
      postgres: {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || '5432',
        database: process.env.POSTGRES_DB || 'safe-client-gateway',
        schema: process.env.POSTGRES_SCHEMA || 'main', //@TODO: use this schema
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
  }, // TODO: Unify base URLs with staking
  earn: {
    testnet: {
      baseUri:
        process.env.STAKING_TESTNET_API_BASE_URI ||
        'https://api.testnet.kiln.fi',
      apiKey: process.env.EARN_TESTNET_API_KEY,
    },
    mainnet: {
      baseUri: process.env.STAKING_API_BASE_URI || 'https://api.kiln.fi',
      apiKey: process.env.EARN_MAINNET_API_KEY,
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
    deviatePercent: parseInt(process.env.EXPIRATION_DEVIATE_PERCENT ?? `${10}`),
    default: parseInt(process.env.EXPIRATION_TIME_DEFAULT_SECONDS ?? `${60}`),
    rpc: parseInt(process.env.EXPIRATION_TIME_RPC_SECONDS ?? `${15}`),
    hoodi: parseInt(process.env.HOODI_EXPIRATION_TIME_SECONDS ?? `${60}`),
    indexing: parseInt(process.env.EXPIRATION_TIME_INDEXING_SECONDS ?? `${5}`),
    staking: parseInt(process.env.EXPIRATION_TIME_STAKING_SECONDS ?? `${60}`),
    zerionPositions: parseInt(
      process.env.EXPIRATION_TIME_POSITIONS_SECONDS ?? `${300}`,
    ),
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
    email: process.env.FF_EMAIL?.toLowerCase() === 'true',
    zerionBalancesChainIds:
      process.env.FF_ZERION_BALANCES_CHAIN_IDS?.split(',') ?? [],
    zerionPositions:
      process.env.FF_ZERION_POSITIONS_DISABLED?.toLowerCase() !== 'true',
    debugLogs: process.env.FF_DEBUG_LOGS?.toLowerCase() === 'true',
    configHooksDebugLogs:
      process.env.FF_CONFIG_HOOKS_DEBUG_LOGS?.toLowerCase() === 'true',
    auth: process.env.FF_AUTH?.toLowerCase() === 'true',
    delegatesV2: process.env.FF_DELEGATES_V2?.toLowerCase() === 'true',
    counterfactualBalances:
      process.env.FF_COUNTERFACTUAL_BALANCES?.toLowerCase() === 'true',
    accounts: process.env.FF_ACCOUNTS?.toLowerCase() === 'true',
    users: process.env.FF_USERS?.toLowerCase() === 'true',
    hookHttpPostEvent:
      process.env.FF_HOOK_HTTP_POST_EVENT?.toLowerCase() === 'true',
    improvedAddressPoisoning:
      process.env.FF_IMPROVED_ADDRESS_POISONING?.toLowerCase() === 'true',
    hashVerification: {
      api: process.env.FF_HASH_VERIFICATION_API?.toLowerCase() === 'true',
      proposal:
        process.env.FF_HASH_VERIFICATION_PROPOSAL?.toLowerCase() === 'true',
    },
    signatureVerification: {
      api: process.env.FF_SIGNATURE_VERIFICATION_API?.toLowerCase() === 'true',
      proposal:
        process.env.FF_SIGNATURE_VERIFICATION_PROPOSAL?.toLowerCase() ===
        'true',
    },
    messageVerification:
      process.env.FF_MESSAGE_VERIFICATION?.toLowerCase() === 'true',
    ethSign: process.env.FF_ETH_SIGN?.toLowerCase() === 'true',
    trustedDelegateCall:
      process.env.FF_TRUSTED_DELEGATE_CALL?.toLowerCase() === 'true',
    // TODO: Remove this feature flag once the feature is established.
    trustedForDelegateCallContractsList:
      process.env.FF_TRUSTED_FOR_DELEGATE_CALL_CONTRACTS_LIST?.toLowerCase() ===
      'true',
    filterValueParsing:
      process.env.FF_FILTER_VALUE_PARSING?.toLowerCase() === 'true',
    vaultTransactionsMapping:
      process.env.FF_VAULT_TRANSACTIONS_MAPPING?.toLowerCase() === 'true',
    lifiTransactionsMapping:
      process.env.FF_LIFITRANSACTIONS_MAPPING?.toLowerCase() === 'true',
    cacheInFlightRequests:
      process.env.HTTP_CLIENT_CACHE_IN_FLIGHT_REQUESTS?.toLowerCase() ===
      'true',
  },
  httpClient: {
    // Timeout in milliseconds to be used for the HTTP client.
    // A value of 0 disables the timeout.
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
  jwt: {
    issuer: process.env.JWT_ISSUER,
    secret: process.env.JWT_SECRET,
  },
  locking: {
    baseUri:
      process.env.LOCKING_PROVIDER_API_BASE_URI ||
      'https://safe-locking.safe.global',
    eligibility: {
      fingerprintEncryptionKey: process.env.FINGERPRINT_ENCRYPTION_KEY,
      nonEligibleCountryCodes:
        process.env.FINGERPRINT_NON_ELIGIBLE_COUNTRY_CODES?.split(',') ?? [
          'US',
        ],
    },
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
    prettyColorize: process.env.LOG_PRETTY_COLORIZE?.toLowerCase() === 'true',
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
      // Note: due to high value formatted token values, we use bigint
      // This means the value tolerance can only be an integer
      valueTolerance: BigInt(process.env.IMITATION_VALUE_TOLERANCE ?? 1),
      echoLimit: BigInt(process.env.IMITATION_ECHO_LIMIT ?? `${10}`),
    },
    history: {
      maxNestedTransfers: parseInt(
        process.env.MAX_NESTED_TRANSFERS ?? `${100}`,
      ),
    },
    transactionData: {
      maxTokenInfoIndexSize: parseInt(process.env.MAX_TOKEN_INFO ?? `${100}`),
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
    getSubscribersBySafeTtlMilliseconds: +(
      process.env.PUSH_NOTIFICATIONS_GET_SUBSCRIBERS_BY_SAFE_TTL_MILLISECONDS ||
      60 * 1_000
    ),
    oauth2TokenTtlBufferInSeconds: parseInt(
      process.env.PUSH_NOTIFICATIONS_API_OAUTH2_TOKEN_TTL_BUFFER_IN_SECONDS ??
        `${120}`,
    ),
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
    baseUri:
      process.env.RELAY_PROVIDER_API_BASE_URI || 'https://api.gelato.digital',
    limit: parseInt(process.env.RELAY_THROTTLE_LIMIT ?? `${5}`),
    ttlSeconds: parseInt(
      process.env.RELAY_THROTTLE_TTL_SECONDS ?? `${60 * 60 * 24}`,
    ),
    dailyLimitRelayerChainsIds:
      process.env.RELAY_DAILY_LIMIT_CHAIN_IDS?.split(',') ?? [],
    apiKey: {
      // Ethereum Mainnet
      1: process.env.RELAY_PROVIDER_API_KEY_MAINNET,
      // Optimism
      10: process.env.RELAY_PROVIDER_API_KEY_OPTIMISM,
      // BNB
      56: process.env.RELAY_PROVIDER_API_KEY_BSC,
      // Gnosis
      100: process.env.RELAY_PROVIDER_API_KEY_GNOSIS_CHAIN,
      // Polygon
      137: process.env.RELAY_PROVIDER_API_KEY_POLYGON,
      // Polygon zkEVM
      1101: process.env.RELAY_PROVIDER_API_KEY_POLYGON_ZKEVM,
      // Base
      8453: process.env.RELAY_PROVIDER_API_KEY_BASE,
      // Arbitrum
      42161: process.env.RELAY_PROVIDER_API_KEY_ARBITRUM_ONE,
      // Avalanche
      43114: process.env.RELAY_PROVIDER_API_KEY_AVALANCHE,
      // Linea
      59144: process.env.RELAY_PROVIDER_API_KEY_LINEA,
      // Blast
      81457: process.env.RELAY_PROVIDER_API_KEY_BLAST,
      // Sepolia
      11155111: process.env.RELAY_PROVIDER_API_KEY_SEPOLIA,
    },
    noFeeCampaign: {
      // Key is the chainId
      1: {
        startsAtTimeStamp: parseInt(
          process.env.RELAY_NO_FEE_CAMPAIGN_MAINNET_START_TIMESTAMP ?? `${0}`,
        ),
        endsAtTimeStamp: parseInt(
          process.env.RELAY_NO_FEE_CAMPAIGN_MAINNET_END_TIMESTAMP ?? `${0}`,
        ),
        maxGasLimit: parseInt(
          process.env.RELAY_NO_FEE_CAMPAIGN_MAINNET_MAX_GAS_LIMIT ?? `${0}`,
        ),
        safeTokenAddress:
          process.env.RELAY_NO_FEE_CAMPAIGN_MAINNET_SAFE_TOKEN_ADDRESS,
        relayRules:
          parseRelayRules(
            process.env.RELAY_NO_FEE_CAMPAIGN_MAINNET_RELAY_RULES,
          ) ?? [],
      },
      11155111: {
        startsAtTimeStamp: parseInt(
          process.env.RELAY_NO_FEE_CAMPAIGN_SEPOLIA_START_TIMESTAMP ?? `${0}`,
        ),
        endsAtTimeStamp: parseInt(
          process.env.RELAY_NO_FEE_CAMPAIGN_SEPOLIA_END_TIMESTAMP ?? `${0}`,
        ),
        maxGasLimit: parseInt(
          process.env.RELAY_NO_FEE_CAMPAIGN_SEPOLIA_MAX_GAS_LIMIT ?? `${0}`,
        ),
        safeTokenAddress:
          process.env.RELAY_NO_FEE_CAMPAIGN_SEPOLIA_SAFE_TOKEN_ADDRESS,
        relayRules:
          parseRelayRules(
            process.env.RELAY_NO_FEE_CAMPAIGN_SEPOLIA_RELAY_RULES,
          ) ?? [],
      },
    },
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
    chains: {
      maxSequentialPages: parseInt(
        process.env.SAFE_CONFIG_CHAINS_MAX_SEQUENTIAL_PAGES ?? `${3}`,
      ),
    },
  },
  safeDataDecoder: {
    baseUri:
      process.env.SAFE_DATA_DECODER_BASE_URI ||
      'https://safe-decoder.safe.global',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
  safeWebApp: {
    baseUri: process.env.SAFE_WEB_APP_BASE_URI || 'https://app.safe.global',
  },
  spaces: {
    addressBooks: {
      maxItems: parseInt(
        process.env.SPACES_MAX_ADDRESS_BOOK_ITEMS_PER_SPACE ?? `${500}`,
      ),
    },
    maxSafesPerSpace: parseInt(
      process.env.SPACES_MAX_SAFES_PER_SPACE ?? `${10}`,
    ),
    maxSpaceCreationsPerUser: parseInt(
      process.env.MAX_SPACE_CREATIONS_PER_USER ?? `${3}`,
    ),
    maxInvites: parseInt(process.env.SPACES_MAX_INVITES ?? `${50}`),
    rateLimit: {
      creation: {
        max: parseInt(process.env.SPACES_RATE_LIMIT_MAX ?? `${10}`),
        windowSeconds: parseInt(
          process.env.SPACES_RATE_LIMIT_WINDOW_SECONDS ?? `${600}`,
        ),
      },
      addressBookUpsertion: {
        max: parseInt(
          process.env.SPACES_ADDRESS_BOOK_RATE_LIMIT_MAX ?? `${500}`,
        ),
        windowSeconds: parseInt(
          process.env.SPACES_ADDRESS_BOOK_RATE_LIMIT_WINDOW_SECONDS ?? `${600}`,
        ),
      },
    },
  },
  staking: {
    testnet: {
      baseUri:
        process.env.STAKING_TESTNET_API_BASE_URI ||
        'https://api.testnet.kiln.fi',
      apiKey: process.env.STAKING_TESTNET_API_KEY,
    },
    mainnet: {
      baseUri: process.env.STAKING_API_BASE_URI || 'https://api.kiln.fi',
      apiKey: process.env.STAKING_API_KEY,
    },
  },
  swaps: {
    // CoW Swap API URLs for different chains
    // See: https://github.com/cowprotocol/cow-sdk/blob/main/packages/order-book/src/api.ts
    api: {
      1: 'https://api.cow.fi/mainnet',
      56: 'https://api.cow.fi/bnb',
      100: 'https://api.cow.fi/xdai',
      137: 'https://api.cow.fi/polygon',
      8453: 'https://api.cow.fi/base',
      232: 'https://api.cow.fi/lens',
      42161: 'https://api.cow.fi/arbitrum_one',
      43114: 'https://api.cow.fi/avalanche',
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
  targetedMessaging: {
    fileStorage: {
      // The type of file storage to use. Defaults to 'local'.
      // Supported values: 'aws', 'local'
      type: process.env.TARGETED_MESSAGING_FILE_STORAGE_TYPE || 'local',
      aws: {
        // This will be ignored if the TARGETED_MESSAGING_FILE_STORAGE_TYPE is set to 'local'.
        // For reference, these environment variables should be present in the environment,
        // but they are not transferred to the memory/configuration file:
        // AWS_REGION
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        bucketName:
          process.env.AWS_STORAGE_BUCKET_NAME || 'safe-client-gateway',
        basePath: process.env.AWS_S3_BASE_PATH || 'assets/targeted-messaging',
      },
      local: {
        // This will be ignored if the TARGETED_MESSAGING_FILE_STORAGE_TYPE is set to 'aws'.
        baseDir:
          process.env.TARGETED_MESSAGING_LOCAL_BASE_DIR ||
          'assets/targeted-messaging',
      },
    },
  },
  csvExport: {
    fileStorage: {
      // The type of file storage to use. Defaults to 'local'.
      // Supported values: 'aws', 'local'
      type: process.env.CSV_EXPORT_FILE_STORAGE_TYPE || 'local',
      aws: {
        // This will be ignored if the CSV_EXPORT_FILE_STORAGE_TYPE is set to 'local'.
        // For reference, these environment variables should be present in the environment,
        // but they are not transferred to the memory/configuration file:
        // AWS_REGION
        accessKeyId: process.env.CSV_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.CSV_AWS_SECRET_ACCESS_KEY,
        bucketName:
          process.env.CSV_AWS_STORAGE_BUCKET_NAME || 'safe-client-gateway',
        basePath: process.env.CSV_AWS_S3_BASE_PATH || 'assets/csv-export',
      },
      local: {
        // This will be ignored if the CSV_EXPORT_FILE_STORAGE_TYPE is set to 'aws'.
        baseDir: process.env.CSV_EXPORT_LOCAL_BASE_DIR || 'assets/csv-export',
      },
    },
    // The time-to-live (TTL) for the signed URLs generated for CSV exports.
    // Defaults to 3600 seconds (1 hour).
    signedUrlTtlSeconds: parseInt(
      process.env.CSV_EXPORT_SIGNED_URL_TTL_SECONDS ?? `${60 * 60}`,
    ),
    // BullMq queue configuration for CSV exports.
    queue: {
      removeOnComplete: {
        age: parseInt(
          process.env.CSV_EXPORT_QUEUE_REMOVE_ON_COMPLETE_AGE ?? `${86400}`,
        ), // 24 hours
        count: parseInt(
          process.env.CSV_EXPORT_QUEUE_REMOVE_ON_COMPLETE_COUNT ?? `${1000}`,
        ), // last 1000
      },
      removeOnFail: {
        age: parseInt(
          process.env.CSV_EXPORT_QUEUE_REMOVE_ON_FAIL_AGE ?? `${43200}`,
        ), // 12 hours
        count: parseInt(
          process.env.CSV_EXPORT_QUEUE_REMOVE_ON_FAIL_COUNT ?? `${100}`,
        ), // last 100
      },
      backoff: {
        type: process.env.CSV_EXPORT_QUEUE_BACKOFF_TYPE || 'exponential',
        delay: parseInt(
          process.env.CSV_EXPORT_QUEUE_BACKOFF_DELAY ?? `${2000}`,
        ), // 2 seconds
      },
      attempts: parseInt(process.env.CSV_EXPORT_QUEUE_ATTEMPTS ?? `${3}`),
      concurrency: parseInt(process.env.CSV_EXPORT_QUEUE_CONCURRENCY ?? `${3}`),
    },
  },
  safeShield: {
    threatAnalysis: {
      blockaid: {
        apiKey: process.env.BLOCKAID_CLIENT_API_KEY,
      },
    },
  },
});

// Helper function to parse relay rules from environment variable
const parseRelayRules = (
  envValue: string | undefined,
): RelayRules | undefined => {
  if (!envValue) {
    return undefined;
  }

  const parsed = JSON.parse(envValue) as RelayRules;
  parsed.every(
    (rule) =>
      typeof rule === 'object' &&
      rule !== null &&
      typeof rule.balanceMin === 'string' &&
      typeof rule.balanceMax === 'string' &&
      typeof rule.limit === 'number' &&
      BigInt(rule.balanceMin) >= 0 &&
      BigInt(rule.balanceMax) >= BigInt(rule.balanceMin) &&
      rule.limit >= 0,
  );
  return parsed;
};
