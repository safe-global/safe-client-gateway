export default () => ({
  about: {
    name: 'safe-client-gateway',
    version: process.env.APPLICATION_VERSION,
    buildNumber: process.env.APPLICATION_BUILD_NUMBER,
  },
  alerts: {
    baseUri:
      process.env.ALERTS_PROVIDER_API_BASE_URI || 'https://api.tenderly.co',
    signingKey: process.env.ALERTS_PROVIDER_SIGNING_KEY,
    apiKey: process.env.ALERTS_PROVIDER_API_KEY,
    account: process.env.ALERTS_PROVIDER_ACCOUNT,
    project: process.env.ALERTS_PROVIDER_PROJECT,
  },
  applicationPort: process.env.APPLICATION_PORT || '3000',
  auth: {
    token: process.env.AUTH_TOKEN,
  },
  db: {
    postgres: {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: process.env.POSTGRES_PORT || '5432',
      database: process.env.POSTGRES_DB || 'safe-client-gateway',
      username: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
    },
  },
  exchange: {
    baseUri:
      process.env.EXCHANGE_API_BASE_URI ||
      'https://api.apilayer.com/exchangerates_data',
    apiKey: process.env.EXCHANGE_API_KEY,
    cacheTtlSeconds: parseInt(
      process.env.EXCHANGE_API_CACHE_TTL_SECONDS ?? `${60 * 60 * 12}`,
    ),
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
  features: {
    pricesProviderChainIds:
      process.env.FF_PRICES_PROVIDER_CHAIN_IDS?.split(',') ?? [],
    humanDescription:
      process.env.FF_HUMAN_DESCRIPTION?.toLowerCase() === 'true',
    messagesCache: process.env.FF_MESSAGES_CACHE?.toLowerCase() === 'true',
    alerts: process.env.FF_ALERTS?.toLowerCase() === 'true',
    noncesRoute: process.env.FF_NONCES_ROUTE?.toLowerCase() === 'true',
  },
  httpClient: {
    // Timeout in milliseconds to be used for the HTTP client.
    // A value of 0 disables the timeout.
    requestTimeout: parseInt(
      process.env.HTTP_CLIENT_REQUEST_TIMEOUT_MILLISECONDS ?? `${5_000}`,
    ),
  },
  log: {
    level: process.env.LOG_LEVEL || 'debug',
    silent: process.env.LOG_SILENT?.toLowerCase() === 'true',
  },
  mappings: {
    history: {
      maxNestedTransfers: parseInt(
        process.env.MAX_NESTED_TRANSFERS ?? `${100}`,
      ),
    },
  },
  prices: {
    baseUri:
      process.env.PRICES_PROVIDER_API_BASE_URI ||
      'https://api.coingecko.com/api/v3',
    apiKey: process.env.PRICES_PROVIDER_API_KEY,
    pricesTtlSeconds: parseInt(process.env.PRICES_TTL_SECONDS ?? `${300}`),
    notFoundPriceTtlSeconds: parseInt(
      process.env.NOT_FOUND_PRICE_TTL_SECONDS ?? `${259200}`,
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
      56: { nativeCoin: 'binancecoin', chainName: 'binance-smart-chain' },
      8453: { nativeCoin: 'ethereum', chainName: 'base' },
    },
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || '6379',
  },
  relay: {
    limit: parseInt(process.env.RELAY_THROTTLE_LIMIT ?? `${5}`),
  },
  safeConfig: {
    baseUri:
      process.env.SAFE_CONFIG_BASE_URI || 'https://safe-config.safe.global/',
  },
  safeTransaction: {
    useVpcUrl: process.env.USE_TX_SERVICE_VPC_URL?.toLowerCase() === 'true',
  },
});
