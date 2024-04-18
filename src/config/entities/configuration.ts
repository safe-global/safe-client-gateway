// Custom configuration for the application
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  applicationPort: process.env.APPLICATION_PORT || '3000',
  auth: {
    token: process.env.AUTH_TOKEN,
    nonceTtlSeconds: parseInt(
      process.env.AUTH_NONCE_TTL_SECONDS ?? `${5 * 60}`,
    ),
  },
  balances: {
    balancesTtlSeconds: parseInt(process.env.BALANCES_TTL_SECONDS ?? `${300}`),
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
          chains: {
            1: { nativeCoin: 'ethereum', chainName: 'ethereum' },
            10: { nativeCoin: 'ethereum', chainName: 'optimistic-ethereum' },
            100: { nativeCoin: 'xdai', chainName: 'xdai' },
            1101: { nativeCoin: 'ethereum', chainName: 'polygon-zkevm' },
            11155111: { nativeCoin: 'ethereum', chainName: 'ethereum' },
            1313161554: { nativeCoin: 'ethereum', chainName: 'aurora' },
            137: { nativeCoin: 'matic-network', chainName: 'polygon-pos' },
            324: { nativeCoin: 'ethereum', chainName: 'zksync' },
            42161: { nativeCoin: 'ethereum', chainName: 'arbitrum-one' },
            42220: { nativeCoin: 'celo', chainName: 'celo' },
            43114: { nativeCoin: 'avalanche-2', chainName: 'avalanche' },
            5: { nativeCoin: 'ethereum', chainName: 'ethereum' },
            534352: { nativeCoin: 'weth', chainName: 'scroll' },
            56: { nativeCoin: 'binancecoin', chainName: 'binance-smart-chain' },
            8453: { nativeCoin: 'ethereum', chainName: 'base' },
            84531: { nativeCoin: 'ethereum', chainName: 'base' },
            84532: { nativeCoin: 'ethereum', chainName: 'base' },
          },
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
          56: { chainName: 'binance-smart-chain' },
          100: { chainName: 'xdai' },
          137: { chainName: 'polygon' },
          324: { chainName: 'zksync-era' },
          // 1101 (Polygon zkEVM) is not available on Zerion
          // 1101: { chainName: '' },
          8453: { chainName: 'base' },
          42161: { chainName: 'arbitrum' },
          42220: { chainName: 'celo' },
          43114: { chainName: 'avalanche' },
          // 11155111 (Sepolia) is not available on Zerion
          // 11155111: { chainName: '' },
          1313161554: { chainName: 'aurora' },
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
    templates: {
      recoveryTx: process.env.EMAIL_TEMPLATE_RECOVERY_TX,
      unknownRecoveryTx: process.env.EMAIL_TEMPLATE_UNKNOWN_RECOVERY_TX,
      verificationCode: process.env.EMAIL_TEMPLATE_VERIFICATION_CODE,
    },
    verificationCode: {
      resendLockWindowMs: parseInt(
        process.env.EMAIL_VERIFICATION_CODE_RESEND_LOCK_WINDOW_MS ??
          `${30 * 1000}`,
      ),
      ttlMs: parseInt(
        process.env.EMAIL_VERIFICATION_CODE_TTL_MS ?? `${5 * 60 * 1000}`,
      ),
    },
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
    locking: process.env.FF_LOCKING?.toLowerCase() === 'true',
    relay: process.env.FF_RELAY?.toLowerCase() === 'true',
    swapsDecoding: process.env.FF_SWAPS_DECODING?.toLowerCase() === 'true',
    historyDebugLogs:
      process.env.FF_HISTORY_DEBUG_LOGS?.toLowerCase() === 'true',
    auth: process.env.FF_AUTH?.toLowerCase() === 'true',
    confirmationView:
      process.env.FF_CONFIRMATION_VIEW?.toLowerCase() === 'true',
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
    history: {
      maxNestedTransfers: parseInt(
        process.env.MAX_NESTED_TRANSFERS ?? `${100}`,
      ),
    },
    safe: {
      maxOverviews: parseInt(process.env.MAX_SAFE_OVERVIEWS ?? `${10}`),
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
      11155111: 'https://api.cow.fi/sepolia',
    },
    explorerBaseUri:
      process.env.SWAPS_EXPLORER_URI || 'https://explorer.cow.fi/',
  },
});
